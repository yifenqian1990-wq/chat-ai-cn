
import React, { useEffect, useState, useRef } from 'react';
import { Plus, MessageSquare, Settings, History, Trash2, Pin, PinOff, Archive, ArchiveRestore, Edit3, Check, X, MoreHorizontal, ListChecks, GripVertical, Ghost, Calendar, Filter, Database, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storageService';
import { ChatSession } from '../types';

interface SidebarProps {
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onNewPrivateChat: () => void; // New callback
  onOpenSettings: (tab: 'settings' | 'activity' | 'archives') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  onClose, 
  currentSessionId, 
  onSelectSession, 
  onNewChat,
  onNewPrivateChat,
  onOpenSettings
}) => {
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Database Status
  const [dbStatus, setDbStatus] = useState<{ connected: boolean, permission: string, name: string | null }>({ connected: false, permission: 'none', name: null });
  
  // Search & Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Batch Select State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<ChatSession | null>(null);

  const loadSessions = async () => {
    try {
      const sessions = await storageService.getAllSessions();
      setRecentSessions(sessions);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  const checkDbStatus = async () => {
     const connected = storageService.hasFileHandle();
     const name = storageService.getConnectedFileName();
     const permission = await storageService.checkPermissionState();
     setDbStatus({ connected, permission, name });
  };

  useEffect(() => {
    loadSessions();
    checkDbStatus();
    const interval = setInterval(loadSessions, 5000); // Polling every 5s instead of 2s to reduce DnD interference
    
    // Listen for status updates
    const handleStatusUpdate = () => checkDbStatus();
    window.addEventListener('storage-db-status', handleStatusUpdate);
    
    return () => {
        clearInterval(interval);
        window.removeEventListener('storage-db-status', handleStatusUpdate);
    };
  }, [currentSessionId]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteSession = async (id: string) => {
    await storageService.deleteSession(id);
    await loadSessions();
    if (currentSessionId === id) {
       onNewChat();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("确定要删除此对话吗？")) {
       handleDeleteSession(id);
       setActiveMenuId(null);
    } else {
       setActiveMenuId(null);
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有对话记录吗？此操作无法撤销。')) {
      await storageService.clearAll();
      loadSessions();
      onNewChat();
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    await storageService.togglePinSession(id);
    loadSessions();
  };

  const handleToggleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    await storageService.toggleArchiveSession(id);
    loadSessions();
    
    if (currentSessionId === id) {
       onNewChat();
    }
  };

  const startRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingId && editTitle.trim()) {
      await storageService.updateSessionTitle(editingId, editTitle.trim());
      setEditingId(null);
      loadSessions();
    } else {
      setEditingId(null);
    }
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };
  
  const toggleMenu = (e: React.MouseEvent, id: string) => {
     e.stopPropagation();
     setActiveMenuId(activeMenuId === id ? null : id);
  };

  // --- Batch Operations ---
  const toggleSelectionMode = () => {
     setIsSelectionMode(!isSelectionMode);
     setSelectedIds(new Set());
     setActiveMenuId(null);
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
     e.stopPropagation();
     const newSet = new Set(selectedIds);
     if (newSet.has(id)) {
        newSet.delete(id);
     } else {
        newSet.add(id);
     }
     setSelectedIds(newSet);
  };

  const handleBatchDelete = async () => {
     if (selectedIds.size === 0) return;
     if (confirm(`确定要删除选中的 ${selectedIds.size} 个对话吗？`)) {
        for (const id of selectedIds) {
           await storageService.deleteSession(id);
        }
        await loadSessions();
        if (currentSessionId && selectedIds.has(currentSessionId)) {
           onNewChat();
        }
        setIsSelectionMode(false);
        setSelectedIds(new Set());
     }
  };

  const handleBatchArchive = async () => {
     if (selectedIds.size === 0) return;
     for (const id of selectedIds) {
        await storageService.toggleArchiveSession(id);
     }
     await loadSessions();
     setIsSelectionMode(false);
     setSelectedIds(new Set());
  };

  const handleBatchUnpin = async () => {
     if (selectedIds.size === 0) return;
     // For batch action, we'll force unpin all selected (or toggle if complex, but unpin is safer)
     // Actually lets just toggle for simplicity as implemented in service, but iterating might be jittery.
     // Let's just call togglePinSession.
     for (const id of selectedIds) {
        // Only toggle if currently pinned to behave as "Unpin Selected"
        const session = recentSessions.find(s => s.id === id);
        if (session && session.isPinned) {
            await storageService.togglePinSession(id);
        }
     }
     await loadSessions();
     setIsSelectionMode(false);
     setSelectedIds(new Set());
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, session: ChatSession) => {
    setDraggedItem(session);
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag image usually preferred
    // e.dataTransfer.setDragImage(new Image(), 0, 0); 
  };

  const handleDragOver = (e: React.DragEvent, targetSession: ChatSession) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetSession.id || !targetSession.isPinned) return;

    // Get current pinned list from state (which is filtered)
    const pinned = recentSessions.filter(s => s.isPinned && !s.isArchived);
    const fromIndex = pinned.findIndex(s => s.id === draggedItem.id);
    const toIndex = pinned.findIndex(s => s.id === targetSession.id);
    
    if (fromIndex < 0 || toIndex < 0) return;

    // Create new order
    const newPinned = [...pinned];
    newPinned.splice(fromIndex, 1);
    newPinned.splice(toIndex, 0, draggedItem);
    
    // Optimistic Update: Update the main state by merging new pinned order + unpinned
    const unpinned = recentSessions.filter(s => !s.isPinned && !s.isArchived);
    const archives = recentSessions.filter(s => s.isArchived);
    
    // We update local state immediately for visual feedback
    setRecentSessions([...newPinned, ...unpinned, ...archives]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    setDraggedItem(null);
    // Persist the new order
    const pinned = recentSessions.filter(s => s.isPinned && !s.isArchived);
    await storageService.reorderPinnedSessions(pinned);
  };

  // --- Filter Logic ---
  const filteredSessions = recentSessions.filter(s => {
    // 1. Text Search (Title OR Message Content)
    const term = searchTerm.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(term);
    // Check if any message text includes the search term (if a term exists)
    const contentMatch = term ? s.messages.some(m => m.text && m.text.toLowerCase().includes(term)) : false;
    
    if (!titleMatch && !contentMatch && term) return false;

    // 2. Date Filter
    if (startDate) {
       // Create date at start of day in local time
       const start = new Date(startDate);
       start.setHours(0,0,0,0);
       if (s.updatedAt < start.getTime()) return false;
    }
    if (endDate) {
       // Create date at end of day in local time
       const end = new Date(endDate);
       end.setHours(23,59,59,999);
       if (s.updatedAt > end.getTime()) return false;
    }

    return true;
  });

  // Split sessions explicitly for rendering
  const pinnedSessions = filteredSessions.filter(s => s.isPinned && !s.isArchived);
  const unpinnedSessions = filteredSessions.filter(s => !s.isPinned && !s.isArchived);
  
  // Grouping Logic
  const getSessionGroupLabel = (timestamp: number) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000; 
    const sevenDaysAgo = todayStart - (7 * 86400000);
    const thirtyDaysAgo = todayStart - (30 * 86400000);

    if (timestamp >= todayStart) return '今天';
    if (timestamp >= yesterdayStart) return '昨天';
    if (timestamp >= sevenDaysAgo) return '本周'; 
    if (timestamp >= thirtyDaysAgo) return '前 30 天';
    return '更早';
  };

  const groupedSessions: Record<string, ChatSession[]> = {};
  const groupOrder = ['今天', '昨天', '本周', '前 30 天', '更早'];
  
  unpinnedSessions.forEach(session => {
      const label = getSessionGroupLabel(session.updatedAt);
      if (!groupedSessions[label]) groupedSessions[label] = [];
      groupedSessions[label].push(session);
  });

  // Database Connection Handler
  const handleDbClick = async () => {
      // If connected but permission not granted, request it
      if (dbStatus.permission !== 'granted') {
          try {
             const granted = await storageService.verifyPermission(true);
             if (granted) {
                 // Success! Trigger an auto-save immediately to verify connection and update file
                 await storageService.triggerAutoSave();
             }
          } catch (e) {
             console.error("Connection failed", e);
             alert("授权请求失败或被取消。");
          }
      } else {
          // Open settings to manage (swap file, create new, etc)
          onOpenSettings('settings');
      }
  };

  const renderSessionItem = (session: ChatSession) => (
    <div 
      key={session.id}
      draggable={session.isPinned && !isSelectionMode}
      onDragStart={(e) => handleDragStart(e, session)}
      onDragOver={(e) => handleDragOver(e, session)}
      onDrop={handleDrop}
      onClick={isSelectionMode ? (e) => toggleSelection(e, session.id) : () => onSelectSession(session.id)}
      className={`group relative w-full flex items-center gap-3 px-3 py-3 md:py-2.5 text-sm rounded-full transition-colors cursor-pointer select-none ${
        currentSessionId === session.id && !isSelectionMode
          ? 'bg-[#d3e3fd] text-[#0b57d0]' 
          : 'text-gray-700 hover:bg-[#e6e9ef]'
      } ${draggedItem?.id === session.id ? 'opacity-50 border-dashed border border-blue-400 bg-blue-50' : ''}`}
      title={`最后保存: ${new Date(session.updatedAt).toLocaleString('zh-CN', { hour12: false })}`}
    >
      {isSelectionMode ? (
         <div className="flex-shrink-0" onClick={(e) => toggleSelection(e, session.id)}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(session.id) ? 'bg-[#1a73e8] border-[#1a73e8]' : 'border-gray-400 bg-white'}`}>
               {selectedIds.has(session.id) && <Check className="w-3 h-3 text-white" />}
            </div>
         </div>
      ) : (
         <div className={`flex-shrink-0 text-gray-500 ${session.isPinned ? 'cursor-grab active:cursor-grabbing' : ''}`}>
           {session.isPinned ? <Pin className="w-4 h-4 rotate-45 text-[#1a73e8]" fill="currentColor" /> : <MessageSquare className="w-4 h-4" />}
         </div>
      )}

      {editingId === session.id ? (
        <div className="flex items-center flex-1 gap-1" onClick={e => e.stopPropagation()}>
           <input 
              type="text" 
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 py-0.5 text-xs outline-none"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
           />
           <button onClick={e => saveRename()} className="p-0.5 text-green-600 hover:bg-green-100 rounded"><Check className="w-3.5 h-3.5"/></button>
           <button onClick={cancelRename} className="p-0.5 text-red-500 hover:bg-red-100 rounded"><X className="w-3.5 h-3.5"/></button>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col">
           <div className="flex items-center gap-2">
              <span className={`truncate ${session.isPinned ? 'font-medium' : ''}`}>{session.title || '新对话'}</span>
           </div>
           {/* Show snippet if matched by content search */}
           {searchTerm && !session.title.toLowerCase().includes(searchTerm.toLowerCase()) && (
              <span className="text-[10px] text-gray-400 truncate">
                 匹配内容: {searchTerm}
              </span>
           )}
        </div>
      )}
      
      {/* 3-Dots Menu Button */}
      {editingId !== session.id && !isSelectionMode && (
        <div className="relative ml-auto">
           <button
              onClick={(e) => toggleMenu(e, session.id)}
              className={`p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-opacity ${activeMenuId === session.id ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}
           >
              <MoreHorizontal className="w-4 h-4" />
           </button>

           {/* Dropdown Menu */}
           {activeMenuId === session.id && (
              <div 
                 ref={menuRef}
                 className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 overflow-hidden animate-[fadeIn_0.1s_ease-out]"
                 onClick={(e) => e.stopPropagation()}
              >
                 <button 
                    onClick={(e) => handleTogglePin(e, session.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                 >
                    {session.isPinned ? (
                       <><PinOff className="w-3.5 h-3.5" /> 取消置顶</>
                    ) : (
                       <><Pin className="w-3.5 h-3.5" /> 置顶对话</>
                    )}
                 </button>
                 <button 
                    onClick={(e) => startRename(e, session)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                 >
                    <Edit3 className="w-3.5 h-3.5" /> 重命名
                 </button>
                 <button 
                    onClick={(e) => handleToggleArchive(e, session.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                 >
                    <Archive className="w-3.5 h-3.5" /> 归档
                 </button>
                 <div className="border-t border-gray-100 my-1"></div>
                 <button 
                    onClick={(e) => handleDeleteClick(e, session.id)}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                 >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                 </button>
              </div>
           )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full py-4 px-3 bg-[#f0f4f9] text-gray-700 relative">
      
      <div className="flex items-center justify-between mb-4">
        {isSelectionMode ? (
           <div className="flex items-center gap-2 w-full animate-[fadeIn_0.2s]">
              <span className="text-sm font-medium text-gray-600 pl-2">已选 {selectedIds.size} 项</span>
              <div className="ml-auto flex gap-1">
                 <button 
                   onClick={handleBatchUnpin}
                   disabled={selectedIds.size === 0}
                   className="p-2 text-gray-500 hover:bg-gray-200 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
                   title="取消置顶"
                 >
                    <PinOff className="w-4 h-4" />
                 </button>
                 <button 
                   onClick={handleBatchArchive}
                   disabled={selectedIds.size === 0}
                   className="p-2 text-gray-500 hover:bg-gray-200 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
                   title="归档"
                 >
                    <Archive className="w-4 h-4" />
                 </button>
                 <button 
                   onClick={handleBatchDelete}
                   disabled={selectedIds.size === 0}
                   className="p-2 text-red-500 hover:bg-red-50 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
                   title="删除"
                 >
                    <Trash2 className="w-4 h-4" />
                 </button>
                 <div className="w-px h-6 bg-gray-300 mx-1"></div>
                 <button 
                   onClick={toggleSelectionMode}
                   className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                   title="退出批量模式"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>
           </div>
        ) : (
           <div className="flex gap-2 animate-[fadeIn_0.2s]">
            <button 
              onClick={onNewChat}
              className="flex items-center gap-2 bg-[#dde3ea]/50 hover:bg-[#dde3ea] text-gray-700 rounded-full px-4 py-3 transition-colors shadow-sm w-fit group"
              title="新建普通对话"
            >
              <Plus className="w-5 h-5 text-gray-500 group-hover:text-gray-800" />
              <span className="text-sm font-medium hidden lg:inline">新对话</span>
            </button>
            
            <button 
              onClick={onNewPrivateChat}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white rounded-full px-3 py-3 transition-colors shadow-sm w-fit group"
              title="新建私密对话 (不保存)"
            >
              <Ghost className="w-5 h-5" />
            </button>

            <button 
              onClick={toggleSelectionMode}
              className="p-3 ml-1 rounded-full text-gray-400 hover:bg-[#dde3ea] hover:text-blue-600 transition-colors"
              title="批量管理"
            >
              <ListChecks className="w-5 h-5" />
            </button>
           </div>
        )}
      </div>
      
      <div className="px-1 mb-2">
          <div className="flex items-center border-b border-gray-300 focus-within:border-[#1a73e8] transition-colors">
             <input 
               type="text" 
               placeholder="搜索标题或内容..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-transparent px-2 py-1 text-sm outline-none placeholder-gray-400"
             />
             <button 
               onClick={() => setShowFilters(!showFilters)}
               className={`p-1.5 rounded-md transition-colors ${showFilters || startDate || endDate ? 'text-[#1a73e8] bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
               title="日期筛选"
             >
                <Filter className="w-3.5 h-3.5" />
             </button>
          </div>
          
          {/* Date Filter Panel */}
          {showFilters && (
             <div className="mt-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm animate-[fadeIn_0.2s_ease-out]">
                <div className="flex flex-col gap-2">
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-500 font-medium">开始日期</label>
                      <input 
                         type="date" 
                         value={startDate}
                         onChange={(e) => setStartDate(e.target.value)}
                         className="text-xs p-1.5 border border-gray-200 rounded focus:border-blue-400 outline-none text-gray-700"
                      />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-500 font-medium">结束日期</label>
                      <input 
                         type="date" 
                         value={endDate}
                         onChange={(e) => setEndDate(e.target.value)}
                         className="text-xs p-1.5 border border-gray-200 rounded focus:border-blue-400 outline-none text-gray-700"
                      />
                   </div>
                   {(startDate || endDate) && (
                      <button 
                         onClick={() => { setStartDate(''); setEndDate(''); }}
                         className="text-xs text-blue-600 hover:underline text-right mt-1"
                      >
                         清除日期
                      </button>
                   )}
                </div>
             </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
        <div className="space-y-1">
          {pinnedSessions.length === 0 && unpinnedSessions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">
               {(searchTerm || startDate || endDate) ? '未找到匹配的对话' : '无历史记录'}
            </div>
          ) : (
            <>
               {/* Render Pinned Sessions First */}
               {pinnedSessions.length > 0 && (
                 <>
                   <div className="text-xs font-bold text-gray-900 px-3 mt-4 mb-2 flex items-center justify-between">
                      <span>置顶</span>
                      <span className="text-[10px] font-normal text-gray-400">可拖拽排序</span>
                   </div>
                   {pinnedSessions.map(s => renderSessionItem(s))}
                   {unpinnedSessions.length > 0 && <div className="border-t border-gray-200 my-2 mx-2"></div>}
                 </>
               )}
               
               {/* Render Grouped Sessions */}
               {groupOrder.map(groupName => {
                  const sessions = groupedSessions[groupName];
                  if (!sessions || sessions.length === 0) return null;
                  return (
                     <React.Fragment key={groupName}>
                        <div className="text-xs font-bold text-gray-900 px-3 mt-4 mb-2">{groupName}</div>
                        {sessions.map(s => renderSessionItem(s))}
                     </React.Fragment>
                  );
               })}
            </>
          )}
        </div>
      </div>

      {/* Bottom Menu */}
      <div className="mt-auto border-t border-[#dadce0] pt-2 space-y-1 bg-[#f0f4f9]">
        
        {/* DB Connection Status Indicator */}
        {dbStatus.connected && (
           <button 
             onClick={handleDbClick}
             className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-full transition-colors group ${dbStatus.permission === 'granted' ? 'text-green-700 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50 bg-orange-50/50'}`}
             title={dbStatus.permission === 'granted' ? `已连接: ${dbStatus.name}` : "点击恢复数据库连接"}
           >
             {dbStatus.permission === 'granted' ? (
                <Database className="w-5 h-5" />
             ) : (
                <AlertCircle className="w-5 h-5 animate-pulse" />
             )}
             <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="truncate w-full text-xs font-bold">
                   {dbStatus.permission === 'granted' ? '数据库已同步' : '点击恢复连接'}
                </span>
                <span className="truncate w-full text-[10px] opacity-70">
                   {dbStatus.name}
                </span>
             </div>
           </button>
        )}

        <button 
          onClick={() => onOpenSettings('archives')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-[#e6e9ef] rounded-full transition-colors"
        >
          <Archive className="w-5 h-5 text-gray-500" />
          <span>归档</span>
        </button>
        <button 
          onClick={() => onOpenSettings('activity')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-[#e6e9ef] rounded-full transition-colors"
        >
          <History className="w-5 h-5 text-gray-500" />
          <span>活动</span>
        </button>
        <button 
          onClick={() => onOpenSettings('settings')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-[#e6e9ef] rounded-full transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-500" />
          <span>设置</span>
        </button>
      </div>
    </div>
  );
};
