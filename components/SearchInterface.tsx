
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Sparkles, ExternalLink, Globe, Loader2, ArrowRight, ChevronDown, Check, Info, Star, Copy, Clock, Trash2, Bookmark as BookmarkIcon, LayoutGrid, List, X, Edit3, FolderOpen, MoreHorizontal, Plus, Settings2, RefreshCw, Cpu, Brain, Zap, Cloud, Laptop, StopCircle, ChevronUp, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { performWebSearch, getSearchConfig } from '../services/searchService';
import { createChat, sendMessageStream } from '../services/geminiService';
import { SearchResult, ModelType, SearchProvider, Bookmark, SearchHistoryItem } from '../types';
import { storageService } from '../services/storageService';

// --- Constants ---
const RESULTS_PER_PAGE = 10;
const SUMMARY_MODELS = [
  { id: ModelType.FLASH, name: 'Gemini 2.5 Flash', icon: Zap },
  { id: ModelType.FLASH_LITE, name: 'Gemini 2.5 Flash Lite', icon: Zap },
  { id: ModelType.PRO, name: 'Gemini 3.0 Pro', icon: Brain },
  { id: ModelType.PRO_THINKING, name: 'Gemini 3.0 Pro (Thinking)', icon: Brain },
  { id: ModelType.ALIYUN, name: 'Aliyun (Qwen/DeepSeek)', icon: Cloud },
  { id: ModelType.SILICONFLOW, name: 'SiliconFlow (DeepSeek)', icon: Cpu },
  { id: ModelType.GROQ, name: 'Groq (Llama3)', icon: Zap },
  { id: ModelType.OLLAMA, name: 'Ollama (Local)', icon: Laptop },
];

// --- Sub-components for better organization ---

const HistoryDropdown = ({ 
   history, 
   onSelect, 
   onDelete, 
   onClear,
   dropdownRef 
}: { 
   history: SearchHistoryItem[], 
   onSelect: (q: string) => void, 
   onDelete: (e: React.MouseEvent, id: string) => void,
   onClear: () => void,
   dropdownRef: React.RefObject<HTMLDivElement | null>
}) => {
   if (history.length === 0) return null;

   return (
      <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-[fadeIn_0.1s]">
         <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {history.slice(0, 8).map((item) => (
               <div 
                  key={item.id} 
                  className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                  onClick={() => onSelect(item.query)}
               >
                  <div className="flex items-center gap-3 text-gray-700 overflow-hidden">
                     <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                     <span className="truncate text-sm">{item.query}</span>
                  </div>
                  <button 
                     onClick={(e) => onDelete(e, item.id)}
                     className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                     <X className="w-3.5 h-3.5" />
                  </button>
               </div>
            ))}
         </div>
         <div className="border-t border-gray-100 p-2 bg-gray-50 flex justify-center">
            <button 
               onClick={onClear}
               className="text-xs text-gray-500 hover:text-red-600 hover:underline"
            >
               清空历史记录
            </button>
         </div>
      </div>
   );
};

const BookmarkEditDialog = ({ 
   bookmark, 
   allGroups, 
   onSave, 
   onDelete, 
   onClose 
}: { 
   bookmark: Bookmark; 
   allGroups: string[]; 
   onSave: (id: string, title: string, group: string) => void; 
   onDelete: (id: string) => void; 
   onClose: () => void; 
}) => {
   const [title, setTitle] = useState(bookmark.title);
   const [group, setGroup] = useState(bookmark.group || '默认收藏夹');
   const [isCreating, setIsCreating] = useState(false);
   const [newGroup, setNewGroup] = useState('');

   // Ensure "默认收藏夹" is always in the list
   const uniqueGroups = Array.from(new Set([...allGroups, '默认收藏夹', 'AI 模型', '阅读列表', '工具资源']));

   const handleSave = () => {
      const finalGroup = isCreating ? (newGroup.trim() || '默认收藏夹') : group;
      onSave(bookmark.id, title, finalGroup);
      onClose();
   };

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={onClose}>
         <div className="bg-white rounded-lg shadow-2xl w-[320px] overflow-hidden border border-gray-200 animate-[fadeIn_0.1s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
               <h3 className="text-sm font-medium text-gray-800">已添加到收藏夹</h3>
               <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
               </button>
            </div>
            
            <div className="p-4 space-y-4">
               {/* Name Input */}
               <div className="space-y-1">
                  <label className="block text-xs text-gray-500">名称</label>
                  <input 
                     value={title}
                     onChange={e => setTitle(e.target.value)}
                     className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
               </div>

               {/* Folder Select */}
               <div className="space-y-1">
                  <label className="block text-xs text-gray-500">文件夹</label>
                  {isCreating ? (
                     <div className="flex gap-2">
                        <input 
                           autoFocus
                           value={newGroup}
                           onChange={e => setNewGroup(e.target.value)}
                           placeholder="输入新文件夹名称"
                           className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                        />
                        <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                     </div>
                  ) : (
                     <select 
                        value={group}
                        onChange={e => {
                           if (e.target.value === '__NEW__') {
                              setIsCreating(true);
                              setNewGroup('');
                           } else {
                              setGroup(e.target.value);
                           }
                        }}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none bg-white"
                     >
                        {uniqueGroups.map(g => (
                           <option key={g} value={g}>📁 {g}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="__NEW__">➕ 新建文件夹...</option>
                     </select>
                  )}
               </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
               <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-100">
                  更多
               </button>
               <div className="flex gap-2">
                  <button 
                     onClick={() => { onDelete(bookmark.id); onClose(); }}
                     className="px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 bg-white transition-colors"
                  >
                     删除
                  </button>
                  <button 
                     onClick={handleSave}
                     className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors"
                  >
                     完成
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};

const BookmarksManager = ({ 
   bookmarks, 
   onDelete, 
   onRename, 
   onGroupChange,
   onClose
}: { 
   bookmarks: Bookmark[], 
   onDelete: (id: string) => void, 
   onRename: (id: string, newTitle: string) => void,
   onGroupChange: (id: string, newGroup: string) => void,
   onClose: () => void
}) => {
   const [editId, setEditId] = useState<string | null>(null);
   const [editTitle, setEditTitle] = useState('');
   const [groupBy, setGroupBy] = useState<'none' | 'group'>('group');
   const [sortBy, setSortBy] = useState<'date' | 'title'>('date');

   // Grouping Logic
   const grouped = useMemo<Record<string, Bookmark[]>>(() => {
      const groups: Record<string, Bookmark[]> = {};
      const sorted = [...bookmarks].sort((a, b) => {
         if (sortBy === 'title') return a.title.localeCompare(b.title);
         return b.createdAt - a.createdAt;
      });

      if (groupBy === 'none') return { 'All': sorted };

      sorted.forEach(b => {
         const g = b.group || '默认收藏夹';
         if (!groups[g]) groups[g] = [];
         groups[g].push(b);
      });
      return groups;
   }, [bookmarks, groupBy, sortBy]);

   const startEdit = (b: Bookmark) => {
      setEditId(b.id);
      setEditTitle(b.title);
   };

   const saveEdit = () => {
      if (editId) {
         onRename(editId, editTitle);
         setEditId(null);
      }
   };

   return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 h-[70vh] flex flex-col animate-[fadeIn_0.3s]">
         <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
               <Star className="w-4 h-4 text-amber-400 fill-current" />
               收藏夹
            </h3>
            <div className="flex gap-2">
               <select 
                  value={groupBy} 
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="text-xs border rounded p-1 bg-gray-50"
               >
                  <option value="group">按分组</option>
                  <option value="none">不分组</option>
               </select>
               <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border rounded p-1 bg-gray-50"
               >
                  <option value="date">按时间</option>
                  <option value="title">按名称</option>
               </select>
               <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {Object.entries(grouped).map(([group, items]) => {
               const groupItems = items as Bookmark[];
               return (
                  <div key={group}>
                     {groupBy === 'group' && (
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
                           <FolderOpen className="w-3.5 h-3.5" />
                           {group}
                           <span className="bg-gray-100 px-1.5 rounded-full text-[10px]">{groupItems.length}</span>
                        </div>
                     )}
                     <div className="space-y-1">
                        {groupItems.map(b => (
                           <div key={b.id} className="group flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                              <img 
                                 src={b.favicon || `https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=32`} 
                                 className="w-4 h-4 rounded-sm" 
                                 onError={(e) => { (e.target as HTMLImageElement).src = "https://www.google.com/favicon.ico"; }}
                              />
                              
                              {editId === b.id ? (
                                 <div className="flex-1 flex items-center gap-2">
                                    <input 
                                       value={editTitle}
                                       onChange={(e) => setEditTitle(e.target.value)}
                                       className="flex-1 text-sm border rounded px-2 py-1"
                                       autoFocus
                                       onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                    />
                                    <button onClick={saveEdit} className="p-1 text-green-600 bg-green-50 rounded"><Check className="w-3 h-3" /></button>
                                 </div>
                              ) : (
                                 <a href={b.url} target="_blank" className="flex-1 min-w-0 text-sm text-gray-700 truncate hover:text-blue-600 hover:underline">
                                    {b.title}
                                 </a>
                              )}

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => startEdit(b)} className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50" title="重命名">
                                    <Edit3 className="w-3.5 h-3.5" />
                                 </button>
                                 
                                 <button 
                                    onClick={() => {
                                       const g = prompt("输入新分组名称", b.group || "");
                                       if (g !== null) onGroupChange(b.id, g);
                                    }} 
                                    className="p-1 text-gray-400 hover:text-purple-500 rounded hover:bg-purple-50" 
                                    title="移动分组"
                                 >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                 </button>

                                 <button onClick={() => onDelete(b.id)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50" title="删除">
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
            {bookmarks.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">暂无收藏</div>}
         </div>
      </div>
   );
};

export const SearchInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState(''); // Persist exact query for pagination
  const [results, setResults] = useState<SearchResult[]>([]);
  const [summary, setSummary] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [summaryModel, setSummaryModel] = useState<ModelType>(ModelType.FLASH);
  const [hasMore, setHasMore] = useState(true);
  
  // Data State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  
  // UI State
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null); // For Popup
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true); // Collapsible summary state
  
  // Provider State
  const [provider, setProvider] = useState<SearchProvider>(SearchProvider.GOOGLE);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const summaryAbortControllerRef = useRef<AbortController | null>(null);

  // Load Data
  useEffect(() => {
     searchInputRef.current?.focus();
     const stored = localStorage.getItem('search_provider') as SearchProvider;
     if (stored) setProvider(stored);

     const storedModel = localStorage.getItem('search_summary_model');
     if (storedModel) setSummaryModel(storedModel as ModelType);

     loadData();
  }, []);

  const loadData = async () => {
      const b = await storageService.getAllBookmarks();
      const h = await storageService.getAllSearchHistory();
      setBookmarks(b);
      setHistory(h);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setIsProviderMenuOpen(false);
      }
      
      // Close dropdown if clicking outside search box AND outside dropdown
      if (
          searchInputRef.current && 
          !searchInputRef.current.parentElement?.contains(event.target as Node) &&
          (!historyDropdownRef.current || !historyDropdownRef.current.contains(event.target as Node))
      ) {
          setShowHistoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProviderSelect = (p: SearchProvider) => {
      setProvider(p);
      localStorage.setItem('search_provider', p);
      setIsProviderMenuOpen(false);
  };

  const getProviderLabel = (p: SearchProvider) => {
      switch(p) {
          case SearchProvider.GOOGLE: return 'Google';
          case SearchProvider.TAVILY: return 'Tavily';
          case SearchProvider.BRAVE: return 'Brave';
          case SearchProvider.DUCKDUCKGO: return 'DuckDuckGo';
          default: return 'Google';
      }
  };

  const generateSummary = async (docs: SearchResult[], model: ModelType, q: string) => {
      if (docs.length === 0) return;
      
      // Cancel previous if running
      if (summaryAbortControllerRef.current) {
         summaryAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      summaryAbortControllerRef.current = controller;
      
      setIsSummarizing(true);
      setSummary(''); // Clear previous
      setIsSummaryExpanded(true); // Auto expand
      
      const context = docs.slice(0, 5).map((r, i) => 
         `[${i+1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
      ).join('\n\n');
      
      const prompt = `Based on the following search results, provide a comprehensive and direct answer to the user's query: "${q}". 
      
      Cite sources using [1], [2] format corresponding to the list provided.
      Format the response with Markdown. Keep it concise but informative.
      
      Search Results:
      ${context}`;
      
      try {
          const chat = createChat(model);
          // FIX: Pass model as the 4th argument (modelOverride) to support external providers
          const stream = await sendMessageStream(chat, prompt, [], model);
          
          let fullText = '';
          for await (const chunk of stream) {
             if (controller.signal.aborted) break;
             if (chunk.text) {
                 fullText += chunk.text;
                 setSummary(fullText);
             }
             // We currently ignore specific 'thinking' blocks in the simple summary view
             // to keep the UI clean, but the model will still "think" before streaming text.
          }
      } catch (err: any) {
          if (err.name !== 'AbortError') {
             console.error("Summary Generation Error", err);
             setSummary(prev => prev + `\n\n*[Error generating summary: ${err.message || 'Unknown Error'}. Please check your API settings or network.]*`);
          }
      } finally {
         if (summaryAbortControllerRef.current === controller) {
             setIsSummarizing(false);
             summaryAbortControllerRef.current = null;
         }
      }
  };

  const stopSummary = () => {
      if (summaryAbortControllerRef.current) {
          summaryAbortControllerRef.current.abort();
          setIsSummarizing(false);
      }
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string, pageIndex: number = 0) => {
    if (e) e.preventDefault();
    
    // Determine the query to use
    // If it's a new search (pageIndex 0), use input or override.
    // If it's pagination (pageIndex > 0), use the last successfully searched query.
    let q = (pageIndex === 0) ? (overrideQuery || query) : lastSearchedQuery;

    if (!q.trim()) return;

    if (pageIndex === 0) {
        // Sync inputs
        if (overrideQuery) setQuery(q);
        setLastSearchedQuery(q);
        
        await storageService.addSearchHistory(q);
        loadData(); // Refresh history

        // Reset state
        setResults([]);
        setSummary('');
        setError('');
        setHasSearched(true);
        setShowBookmarks(false);
        setHasMore(true);
    }
    
    setShowHistoryDropdown(false);
    setIsSearching(true);

    try {
      // 1. Fetch Search Results with pagination
      // IMPORTANT: Use pageIndex which is based on results.length for safe offsets
      const searchData = await performWebSearch(q, pageIndex);
      
      if (pageIndex === 0) {
          setResults(searchData);
          if (searchData.length < RESULTS_PER_PAGE) setHasMore(false);
          
          // Only auto-generate summary on initial search
          if (searchData.length > 0) {
             setIsSearching(false);
             await generateSummary(searchData, summaryModel, q);
          } else {
             setIsSearching(false);
          }
      } else {
          // Append results for "Load More"
          let addedCount = 0;
          setResults(prev => {
              // Simple deduplication based on URL to avoid repeating results from non-strict APIs
              const existingUrls = new Set(prev.map(r => r.url));
              const newItems = searchData.filter(r => !existingUrls.has(r.url));
              addedCount = newItems.length;
              return [...prev, ...newItems];
          });
          
          // Logic: If the API returned fewer than requested OR after dedupe we added nothing, consider end reached.
          // Exception: If we added 0 items but the API returned distinct items (unlikely with set), logic stands.
          // Better heuristic: If fetched < per_page, end.
          if (searchData.length < 2) { // Allow small overlap
             setHasMore(false);
          }
          
          setIsSearching(false);
          
          // Visual feedback if we loaded data but it was all duplicate
          if (searchData.length > 0 && addedCount === 0) {
             // This happens with providers that don't support deep pagination (like Tavily Basic)
             setHasMore(false); // Stop user from trying again
          }
      }
      
    } catch (err: any) {
       console.error(err);
       setError(err.message || "Search failed. Please check your API settings.");
       setIsSearching(false);
    }
  };
  
  const handleLoadMore = () => {
      if (isSearching || !hasMore) return;
      // Use current results length as the next start index to ensure continuity
      const nextIndex = results.length;
      handleSearch(undefined, undefined, nextIndex);
  };

  const handleModelChange = (model: ModelType) => {
      setSummaryModel(model);
      localStorage.setItem('search_summary_model', model);
      
      // If we already have results, regenerate summary with new model
      if (results.length > 0 && query) {
          generateSummary(results, model, query);
      }
  };

  // --- Bookmark Logic ---
  const handleStarClick = async (result: SearchResult, e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();

     let targetBookmark = bookmarks.find(b => b.url === result.url);
     
     if (!targetBookmark) {
        // Create new
        const newBookmark: Bookmark = {
           id: Date.now().toString(),
           title: result.title,
           url: result.url,
           favicon: result.favicon,
           createdAt: Date.now(),
           group: '默认收藏夹' // Default group
        };
        await storageService.addBookmark(newBookmark);
        targetBookmark = newBookmark;
        // Refresh local state immediately to show filled star
        await loadData();
     }
     
     // Open Dialog for editing (both new and existing)
     // Use a timeout to ensure state update propagates if it was just added
     setTimeout(() => setEditingBookmark(targetBookmark || null), 50);
  };
  
  const isBookmarked = (url: string) => bookmarks.some(b => b.url === url);

  // Dialog handlers
  const handleDialogSave = async (id: string, title: string, group: string) => {
     const b = bookmarks.find(i => i.id === id);
     if(b) {
        await storageService.addBookmark({ ...b, title, group });
        loadData();
     }
  };

  // Manager handlers
  const handleBookmarkDelete = async (id: string) => {
      await storageService.removeBookmark(id);
      loadData();
  };

  const handleBookmarkRename = async (id: string, title: string) => {
     const b = bookmarks.find(i => i.id === id);
     if(b) {
        await storageService.addBookmark({ ...b, title }); // put overwrites
        loadData();
     }
  };
  
  const handleBookmarkGroup = async (id: string, group: string) => {
     const b = bookmarks.find(i => i.id === id);
     if(b) {
        await storageService.addBookmark({ ...b, group });
        loadData();
     }
  };

  // --- History Logic ---
  const handleHistoryDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await storageService.removeSearchHistory(id);
      loadData();
  };
  
  const handleHistoryClear = async () => {
      if(confirm("确定要清空搜索历史吗？")) {
         await storageService.clearSearchHistory();
         loadData();
      }
  };
  
  const copyToClipboard = (text: string) => {
     navigator.clipboard.writeText(text);
  };

  // Get unique groups for the dialog dropdown
  const allGroups = useMemo(() => Array.from(new Set(bookmarks.map(b => b.group || '默认收藏夹'))), [bookmarks]);
  
  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-y-auto custom-scrollbar relative">
       
       {/* Global Bookmark Edit Dialog */}
       {editingBookmark && (
          <BookmarkEditDialog 
             bookmark={editingBookmark}
             allGroups={allGroups}
             onSave={handleDialogSave}
             onDelete={handleBookmarkDelete}
             onClose={() => setEditingBookmark(null)}
          />
       )}

       <div className={`transition-all duration-500 ease-in-out flex flex-col items-center justify-center px-4 ${hasSearched ? 'py-6' : 'h-[80vh]'}`}>
          
          {/* Logo / Header */}
          <div className={`flex items-center gap-3 mb-6 transition-all duration-500 ${hasSearched ? 'scale-75 mb-4' : 'scale-100'}`}>
             <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                <Globe className="w-8 h-8" />
             </div>
             <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Web Search</h1>
          </div>

          {/* Toolbar */}
          {!hasSearched && (
             <div className="flex gap-4 mb-8">
                <button 
                  onClick={() => setShowBookmarks(!showBookmarks)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${showBookmarks ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}
                >
                   <BookmarkIcon className="w-4 h-4" />
                   收藏夹 ({bookmarks.length})
                </button>
             </div>
          )}

          {/* Search Bar Container */}
          <div className={`w-full max-w-2xl relative transition-all duration-500 z-40 ${hasSearched ? 'shadow-sm' : 'shadow-xl'}`}>
             <form onSubmit={(e) => handleSearch(e, undefined, 0)} className="flex items-center w-full bg-white rounded-full border border-gray-200 shadow-sm focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all p-1 relative z-50">
                
                {/* Provider Selector */}
                <div className="relative" ref={providerMenuRef}>
                    <button
                        type="button"
                        onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                        className="flex items-center gap-1.5 px-3 py-2.5 ml-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full transition-colors border-r border-transparent hover:border-gray-200"
                        title="切换搜索引擎"
                    >
                        <span className="hidden sm:inline">{getProviderLabel(provider)}</span>
                        <span className="sm:hidden">{getProviderLabel(provider).substring(0,2)}</span>
                        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isProviderMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isProviderMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-1 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                            {[SearchProvider.GOOGLE, SearchProvider.TAVILY, SearchProvider.BRAVE, SearchProvider.DUCKDUCKGO].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => handleProviderSelect(p)}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${provider === p ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
                                >
                                    <span>{getProviderLabel(p)}</span>
                                    {provider === p && <Check className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                            <div className="border-t border-gray-100 my-1"></div>
                            <div className="px-3 py-2 text-[10px] text-gray-400 bg-gray-50/50">
                               <div className="flex items-start gap-1">
                                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>部分引擎需要 API Key</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-gray-200 mx-2"></div>

                <input 
                   ref={searchInputRef}
                   type="text" 
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   onFocus={() => setShowHistoryDropdown(true)}
                   placeholder="Search the web..."
                   className="flex-1 bg-transparent border-none outline-none py-3 text-lg placeholder-gray-400 min-w-0"
                />
                
                <button 
                   type="submit"
                   disabled={!query.trim() || isSearching}
                   className="p-2.5 mr-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0"
                >
                   {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                </button>
             </form>

             {/* History Dropdown */}
             {showHistoryDropdown && (
                <HistoryDropdown 
                   dropdownRef={historyDropdownRef}
                   history={history} 
                   onSelect={(q) => handleSearch(undefined, q, 0)} 
                   onDelete={handleHistoryDelete}
                   onClear={handleHistoryClear}
                />
             )}
          </div>
          
          {/* Bookmark Manager in empty state */}
          {!hasSearched && showBookmarks && (
             <div className="w-full max-w-4xl mt-8 animate-[fadeIn_0.3s]">
                <BookmarksManager 
                   bookmarks={bookmarks} 
                   onDelete={handleBookmarkDelete}
                   onRename={handleBookmarkRename}
                   onGroupChange={handleBookmarkGroup}
                   onClose={() => setShowBookmarks(false)}
                />
             </div>
          )}

          {/* Error Message */}
          {error && (
             <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-center gap-2 animate-[fadeIn_0.3s]">
                <Globe className="w-4 h-4" />
                {error}
             </div>
          )}
       </div>

       {/* Results Area */}
       {hasSearched && (
          <div className="w-full max-w-5xl mx-auto px-4 pb-20 animate-[slideUp_0.5s_ease-out]">
             
             {/* Bookmarks Toggle in Result View */}
             {showBookmarks && (
                 <div className="mb-6 animate-[fadeIn_0.3s]">
                     <BookmarksManager 
                        bookmarks={bookmarks} 
                        onDelete={handleBookmarkDelete}
                        onRename={handleBookmarkRename}
                        onGroupChange={handleBookmarkGroup}
                        onClose={() => setShowBookmarks(false)}
                     />
                 </div>
             )}
             
             <div className="flex justify-end mb-4">
                 <button 
                   onClick={() => setShowBookmarks(!showBookmarks)}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${showBookmarks ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                 >
                    <BookmarkIcon className="w-4 h-4" />
                    {showBookmarks ? '关闭收藏夹' : '管理收藏'}
                 </button>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: AI Overview */}
                <div className="lg:col-span-2 space-y-6">
                   {/* AI Summary Card */}
                   <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 relative overflow-hidden group/summary">
                      <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-blue-600 font-medium">
                             <Sparkles className="w-5 h-5" />
                             <h2>AI Overview</h2>
                             {isSummarizing && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {/* Stop / Refresh Actions */}
                             {isSummarizing ? (
                                <button 
                                   onClick={stopSummary}
                                   className="p-1.5 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                                   title="停止生成"
                                >
                                   <StopCircle className="w-4 h-4" />
                                </button>
                             ) : (
                                <button 
                                   onClick={() => generateSummary(results, summaryModel, lastSearchedQuery || query)}
                                   className="p-1.5 rounded-full hover:bg-blue-50 text-blue-500 transition-colors"
                                   title="重新生成"
                                   disabled={results.length === 0}
                                >
                                   <RefreshCw className="w-4 h-4" />
                                </button>
                             )}

                             {/* Collapse Toggle */}
                             <button
                                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                title={isSummaryExpanded ? "收起" : "展开"}
                             >
                                {isSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                             </button>

                             {/* Model Selector */}
                             <div className="relative flex items-center gap-1 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-1 border border-transparent hover:border-gray-200 transition-colors ml-1">
                                 <select 
                                    value={summaryModel}
                                    onChange={(e) => handleModelChange(e.target.value as ModelType)}
                                    className="appearance-none bg-transparent border-none outline-none pr-4 cursor-pointer hover:text-blue-600"
                                    title="选择总结模型"
                                 >
                                     {SUMMARY_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                     ))}
                                 </select>
                                 <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none" />
                             </div>
                          </div>
                      </div>
                      
                      {isSummaryExpanded && (
                         <div className="markdown-body text-sm leading-relaxed text-gray-800 animate-[fadeIn_0.3s]">
                            {summary ? (
                               <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                     a: ({href, children}) => <a href={href} target="_blank" className="text-blue-600 hover:underline">{children}</a>
                                  }}
                               >
                                  {summary}
                               </ReactMarkdown>
                            ) : (
                               isSummarizing ? (
                                  <div className="space-y-2 animate-pulse">
                                     <div className="h-4 bg-gray-100 rounded w-full"></div>
                                     <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                                     <div className="h-4 bg-gray-100 rounded w-4/6"></div>
                                  </div>
                               ) : (
                                  <div className="flex flex-col items-center justify-center py-6 text-gray-400 gap-2">
                                     <RefreshCw className="w-6 h-6 opacity-20" />
                                     <p className="italic">等待生成摘要...</p>
                                     <button onClick={() => generateSummary(results, summaryModel, lastSearchedQuery || query)} className="text-xs text-blue-500 hover:underline">
                                         点击手动生成
                                     </button>
                                  </div>
                               )
                            )}
                         </div>
                      )}
                      
                      {/* Decorative Background Blur */}
                      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                   </div>

                   {/* Search Results List */}
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pl-1">Search Results ({results.length})</h3>
                      </div>

                      {results.map((result, idx) => {
                         const bookmarked = isBookmarked(result.url);
                         return (
                           <div key={`${result.url}-${idx}`} className="bg-white p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group relative">
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="block pr-8">
                                 <div className="flex items-center gap-2 mb-1">
                                    {result.favicon && (
                                       <img 
                                          src={result.favicon} 
                                          alt="" 
                                          className="w-4 h-4 rounded-sm" 
                                          onError={(e) => { (e.target as HTMLImageElement).src = "https://www.google.com/favicon.ico"; }}
                                       />
                                    )}
                                    <span className="text-xs text-gray-500 truncate">{new URL(result.url).hostname}</span>
                                 </div>
                                 <h3 className="text-base font-medium text-blue-700 group-hover:underline mb-1 line-clamp-1">{result.title}</h3>
                                 <p className="text-sm text-gray-600 line-clamp-2">{result.content}</p>
                              </a>

                              {/* Action Buttons */}
                              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={() => copyToClipboard(result.url)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                    title="复制链接"
                                 >
                                    <Copy className="w-3.5 h-3.5" />
                                 </button>
                                 <button 
                                    onClick={(e) => handleStarClick(result, e)}
                                    className={`p-1.5 rounded transition-colors ${bookmarked ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                                    title={bookmarked ? "编辑收藏" : "加入收藏"}
                                 >
                                    <Star className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                                 </button>
                              </div>
                           </div>
                         );
                      })}
                      
                      {/* Fixed: Load More Button */}
                      {hasMore && results.length > 0 && (
                          <div className="flex items-center justify-center py-6 border-t border-transparent">
                            <button 
                                onClick={handleLoadMore}
                                disabled={isSearching}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
                                {isSearching ? '正在加载...' : '加载更多结果'}
                            </button>
                          </div>
                      )}

                      {results.length === 0 && !isSearching && !error && (
                         <div className="text-center py-10 text-gray-400">No results found.</div>
                      )}
                   </div>
                </div>

                {/* Right Column: Sources / Quick Links */}
                <div className="hidden lg:block space-y-4">
                   <div className="sticky top-4">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Sources</h3>
                      <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm">
                         {results.slice(0, 6).map((result, idx) => (
                            <a 
                               key={`source-${idx}`}
                               href={result.url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors group"
                            >
                               <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                  {idx + 1}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-gray-800 truncate">{result.title}</div>
                                  <div className="text-[10px] text-gray-400 truncate">{new URL(result.url).hostname}</div>
                               </div>
                               <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                         ))}
                      </div>
                   </div>
                </div>

             </div>
          </div>
       )}
    </div>
  );
};
