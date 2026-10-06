
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Settings, Database, Key, HardDrive, Check, AlertCircle, 
  RefreshCcw, FolderOpen, FileCode, Download, Upload, Eye, EyeOff, 
  Save, RotateCcw, Server, Globe, Cpu, Volume2, Search as SearchIcon, 
  Cloud, Laptop, Mic2, Activity, Archive, Menu, ChevronRight, Bookmark, Plus, Trash2, Edit3, Zap, ArchiveRestore, Calendar, Network, Info, Link as LinkIcon
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { testApiKeyConnection, resetAI } from '../services/geminiService';
import { SearchProvider, ModelType, ChatSession, CustomProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'settings' | 'activity' | 'archives' | 'search';
}

// Re-introduced PresetManager for custom model management
const PresetManager = ({ 
  title, 
  storageKey, 
  currentValue, 
  onSelect, 
  placeholderLabel, 
  placeholderValue,
  defaultPresets = [] 
}: {
  title: string,
  storageKey: string,
  currentValue: string,
  onSelect: (val: string) => void,
  placeholderLabel: string,
  placeholderValue: string,
  defaultPresets?: {name: string, value: string}[]
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<{name: string, value: string}[]>([]);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      } else if (defaultPresets.length > 0) {
         setItems(defaultPresets);
      }
    } catch(e) {}
  }, [storageKey, defaultPresets]);

  const handleSave = (newItems: {name: string, value: string}[]) => {
    setItems(newItems);
    localStorage.setItem(storageKey, JSON.stringify(newItems));
    storageService.triggerAutoSave(); 
  };

  const add = () => {
    if(!newName.trim() || !newValue.trim()) return;
    const updated = [...items, { name: newName.trim(), value: newValue.trim() }];
    handleSave(updated);
    setNewName('');
    setNewValue('');
  };

  const remove = (index: number) => {
    if(!confirm("确认删除此预设?")) return;
    const updated = items.filter((_, i) => i !== index);
    handleSave(updated);
  };

  const startEdit = (index: number, item: {name: string, value: string}) => {
      setEditingIndex(index);
      setEditName(item.name);
      setEditValue(item.value);
  };

  const saveEdit = () => {
      if (editingIndex === null) return;
      const updated = [...items];
      updated[editingIndex] = { name: editName.trim(), value: editValue.trim() };
      handleSave(updated);
      setEditingIndex(null);
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-[#1a73e8] transition-colors select-none w-full text-left"
       >
          <Bookmark className="w-3.5 h-3.5" />
          <span>{title}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ml-auto ${isOpen ? 'rotate-90' : ''}`} />
       </button>
       
       {isOpen && (
          <div className="mt-2 bg-gray-50 rounded-xl p-3 border border-gray-200 animate-[fadeIn_0.2s_ease-out]">
              {items.length > 0 ? (
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {items.map((item, i) => (
                          <div key={i} className={`flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm transition-colors group ${editingIndex === i ? 'border-blue-400 ring-2 ring-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                              {editingIndex === i ? (
                                  <div className="flex-1 flex gap-2 items-center mr-1">
                                      <input className="w-1/3 text-xs p-1.5 border border-gray-300 rounded focus:border-blue-500 outline-none" value={editName} onChange={e => setEditName(e.target.value)} placeholder="名称" />
                                      <input className="flex-1 text-xs p-1.5 border border-gray-300 rounded focus:border-blue-500 outline-none" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="值" />
                                  </div>
                              ) : (
                                  <div className="flex-1 min-w-0 mr-2 cursor-pointer" onClick={() => onSelect(item.value)}>
                                      <div className="flex items-center gap-2">
                                         <div className="text-xs font-bold text-gray-700 truncate">{item.name}</div>
                                         {currentValue === item.value && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full flex-shrink-0">当前</span>}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5" title={item.value}>{item.value}</div>
                                  </div>
                              )}
                              
                              <div className="flex items-center gap-1">
                                  {editingIndex === i ? (
                                      <>
                                          <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => setEditingIndex(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                                      </>
                                  ) : (
                                      <>
                                          <button onClick={() => onSelect(item.value)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Check className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => startEdit(i, item)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => remove(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              ) : <div className="text-center py-2 text-xs text-gray-400 mb-2 border border-dashed border-gray-300 rounded-lg">无预设记录</div>}

              <div className="flex gap-2 items-center pt-2 border-t border-gray-200/50">
                  <input className="w-1/3 text-xs p-2 border border-gray-200 rounded-lg focus:border-blue-400 outline-none transition-colors" placeholder={placeholderLabel} value={newName} onChange={e => setNewName(e.target.value)} />
                  <input className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:border-blue-400 outline-none transition-colors" placeholder={placeholderValue} value={newValue} onChange={e => setNewValue(e.target.value)} />
                  <button onClick={add} disabled={!newName.trim() || !newValue.trim()} className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors shadow-sm"><Plus className="w-3.5 h-3.5" /></button>
              </div>
          </div>
       )}
    </div>
  );
};

// New Component: CustomProviderManager
const CustomProviderManager = ({
    providers,
    onProvidersChange
}: {
    providers: CustomProvider[],
    onProvidersChange: (newProviders: CustomProvider[]) => void
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [model, setModel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleAdd = () => {
        if (!name || !url || !model) return;
        const newProvider: CustomProvider = {
            id: Date.now().toString(),
            name,
            baseUrl: url,
            apiKey: key,
            defaultModel: model
        };
        onProvidersChange([...providers, newProvider]);
        reset();
    };

    const handleSave = () => {
        if (!editingId) return;
        const updated = providers.map(p => p.id === editingId ? { ...p, name, baseUrl: url, apiKey: key, defaultModel: model } : p);
        onProvidersChange(updated);
        reset();
    };

    const handleEdit = (p: CustomProvider) => {
        setEditingId(p.id);
        setName(p.name);
        setUrl(p.baseUrl);
        setKey(p.apiKey);
        setModel(p.defaultModel);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm("确定删除此接口吗？")) return;
        onProvidersChange(providers.filter(p => p.id !== id));
    };

    const reset = () => {
        setName(''); setUrl(''); setKey(''); setModel(''); setEditingId(null); setIsAdding(false);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700">自定义 API 接口管理器</span>
                <button onClick={() => setIsAdding(true)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-4">
                {isAdding && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-3 animate-[fadeIn_0.2s]">
                        <div className="grid grid-cols-2 gap-2">
                            <input className="text-xs p-2 border border-gray-300 rounded outline-none focus:border-blue-500" placeholder="显示名称 (例如: 内部接口)" value={name} onChange={e => setName(e.target.value)} />
                            <input className="text-xs p-2 border border-gray-300 rounded outline-none focus:border-blue-500" placeholder="模型 ID (例如: gpt-4o)" value={model} onChange={e => setModel(e.target.value)} />
                        </div>
                        <input className="w-full text-xs p-2 border border-gray-300 rounded outline-none focus:border-blue-500" placeholder="Base URL (例如: https://api.proxy.com/v1)" value={url} onChange={e => setUrl(e.target.value)} />
                        <input type="password" className="w-full text-xs p-2 border border-gray-300 rounded outline-none focus:border-blue-500" placeholder="API Key" value={key} onChange={e => setKey(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={reset} className="text-xs text-gray-500 px-3 py-1.5 hover:bg-gray-100 rounded">取消</button>
                            <button onClick={editingId ? handleSave : handleAdd} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 shadow-sm">{editingId ? '保存' : '添加'}</button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {providers.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-800 truncate">{p.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono truncate">{p.baseUrl}</div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
                    {providers.length === 0 && !isAdding && (
                        <div className="text-center py-4 text-xs text-gray-400 italic">暂无自定义接口</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// New Component: KeyManager
const KeyManager = ({
  keys,
  onKeysChange,
  activeKey,
  onSelect
}: {
  keys: {label: string, key: string, created: number}[],
  onKeysChange: (keys: any[]) => void,
  activeKey: string,
  onSelect: (key: string) => void
}) => {
  const [label, setLabel] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  
  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKeyValue, setEditKeyValue] = useState('');
  const [showEditValue, setShowEditValue] = useState(false);

  const addKey = () => {
    if (!label.trim() || !keyValue.trim()) return;
    const newKeys = [...keys, { label: label.trim(), key: keyValue.trim(), created: Date.now() }];
    onKeysChange(newKeys);
    setLabel('');
    setKeyValue('');
  };

  const removeKey = (index: number) => {
    if (!confirm('确定要删除此密钥吗？')) return;
    const newKeys = [...keys];
    newKeys.splice(index, 1);
    onKeysChange(newKeys);
    if (editingIndex === index) setEditingIndex(null);
  };
  
  const startEdit = (index: number, k: {label: string, key: string}) => {
      setEditingIndex(index);
      setEditLabel(k.label);
      setEditKeyValue(k.key);
      setShowEditValue(false);
  };
  
  const saveEdit = () => {
      if (editingIndex === null) return;
      if (!editLabel.trim() || !editKeyValue.trim()) return;
      
      const newKeys = [...keys];
      newKeys[editingIndex] = { 
          ...newKeys[editingIndex], 
          label: editLabel.trim(), 
          key: editKeyValue.trim() 
      };
      onKeysChange(newKeys);
      setEditingIndex(null);
  };

  const cancelEdit = () => {
      setEditingIndex(null);
  };

  return (
    <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm animate-[fadeIn_0.3s]">
        <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 flex justify-between items-center backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold text-gray-700">密钥管理器 (Key Vault)</span>
            </div>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{keys.length}</span>
        </div>
        
        {/* List */}
        <div className="max-h-48 overflow-y-auto p-2 space-y-2 bg-gray-50/30 custom-scrollbar">
            {keys.length === 0 ? (
                <div className="text-center py-6 flex flex-col items-center gap-2 opacity-50">
                    <Key className="w-8 h-8 text-gray-300" />
                    <span className="text-xs text-gray-400">暂无保存的密钥</span>
                </div>
            ) : (
                keys.map((k, i) => {
                    const isActive = k.key === activeKey;
                    const isEditing = editingIndex === i;

                    if (isEditing) {
                        return (
                             <div key={i} className="flex flex-col gap-2 p-3 bg-white border border-blue-400 rounded-lg shadow-sm">
                                <div className="flex gap-2">
                                    <input 
                                        className="flex-1 text-xs p-2 border border-gray-300 rounded focus:border-blue-500 outline-none"
                                        value={editLabel}
                                        onChange={e => setEditLabel(e.target.value)}
                                        placeholder="标签名称"
                                        autoFocus
                                    />
                                </div>
                                <div className="relative">
                                    <input 
                                        type={showEditValue ? "text" : "password"}
                                        className="w-full text-xs p-2 border border-gray-300 rounded focus:border-blue-500 outline-none pr-8 font-mono"
                                        value={editKeyValue}
                                        onChange={e => setEditKeyValue(e.target.value)}
                                        placeholder="API Key"
                                    />
                                    <button onClick={() => setShowEditValue(!showEditValue)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                                        {showEditValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                <div className="flex justify-end gap-2 mt-1">
                                    <button onClick={cancelEdit} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">取消</button>
                                    <button onClick={saveEdit} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"><Check className="w-3 h-3" /> 保存</button>
                                </div>
                             </div>
                        );
                    }

                    return (
                        <div key={i} className={`group flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'}`}>
                            <div className="flex-1 min-w-0 flex flex-col cursor-pointer" onClick={() => onSelect(k.key)}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{k.label}</span>
                                    {isActive && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"><Check className="w-2.5 h-2.5" /> 使用中</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">
                                        {k.key.length > 12 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '******'}
                                    </code>
                                    <span className="text-[10px] text-gray-300">
                                        {new Date(k.created).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => onSelect(k.key)}
                                    className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-blue-200 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                    title="使用此密钥"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => startEdit(i, k)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title="编辑"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => removeKey(i)} 
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    title="删除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* Add New */}
        <div className="p-3 bg-white border-t border-gray-200 space-y-3">
            <div className="flex items-center gap-2">
                <input 
                    className="flex-[2] text-xs p-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="标签 (例如: 工作账号)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                />
                <div className="relative flex-[3]">
                    <input 
                        type={showValue ? "text" : "password"}
                        className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none transition-all bg-gray-50 focus:bg-white pr-8"
                        placeholder="API Key (AIzaSy...)"
                        value={keyValue}
                        onChange={e => setKeyValue(e.target.value)}
                    />
                    <button onClick={() => setShowValue(!showValue)} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                        {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                </div>
                <button 
                    onClick={addKey}
                    disabled={!label || !keyValue}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm flex items-center gap-1"
                >
                    <Plus className="w-3.5 h-3.5" /> 添加
                </button>
            </div>
        </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, activeTab: initialTab }) => {
  const [currentSection, setCurrentSection] = useState<'general' | 'models' | 'search' | 'voice' | 'data' | 'archives'>('general');
  
  // -- General / Gemini State --
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('gemini_base_url') || '');
  const [systemInstruction, setSystemInstruction] = useState(localStorage.getItem('gemini_custom_instructions') || '');
  const [showKey, setShowKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [savedKeys, setSavedKeys] = useState<{label: string, key: string, created: number}[]>([]);
  
  // -- Proxy State --
  const [proxyEnabled, setProxyEnabled] = useState(localStorage.getItem('global_proxy_enabled') === 'true');
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('global_proxy_url') || '');

  // -- Models State --
  const [ollamaHost, setOllamaHost] = useState(localStorage.getItem('ollama_host') || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('ollama_model') || 'qwen2.5:3b');
  const [aliyunKey, setAliyunKey] = useState(localStorage.getItem('aliyun_api_key') || '');
  const [aliyunModel, setAliyunModel] = useState(localStorage.getItem('aliyun_model') || 'qwen-plus');
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [groqModel, setGroqModel] = useState(localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile');
  const [siliconFlowKey, setSiliconFlowKey] = useState(localStorage.getItem('siliconflow_api_key') || '');
  const [siliconFlowModel, setSiliconFlowModel] = useState(localStorage.getItem('siliconflow_model') || 'deepseek-ai/DeepSeek-R1');
  const [openRouterKey, setOpenRouterKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [openRouterModel, setOpenRouterModel] = useState(localStorage.getItem('openrouter_model') || 'google/gemini-2.0-flash-001');

  // -- Custom Providers --
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);

  // -- Search State --
  const [searchProvider, setSearchProvider] = useState<SearchProvider>((localStorage.getItem('search_provider') as SearchProvider) || SearchProvider.GOOGLE);
  const [googleSearchKey, setGoogleSearchKey] = useState(localStorage.getItem('search_google_key') || '');
  const [googleCx, setGoogleCx] = useState(localStorage.getItem('search_google_cx') || '');
  const [savedSearchKeys, setSavedSearchKeys] = useState<{label: string, key: string, created: number}[]>([]);
  const [tavilyKey, setTavilyKey] = useState(localStorage.getItem('search_tavily_key') || '');
  const [braveKey, setBraveKey] = useState(localStorage.getItem('search_brave_key') || '');

  // -- Voice / Live State --
  const [liveProvider, setLiveProvider] = useState(localStorage.getItem('live_model_provider') || 'gemini_native');
  const [googleTtsKey, setGoogleTtsKey] = useState(localStorage.getItem('google_tts_key') || '');
  const [edgeTtsUrl, setEdgeTtsUrl] = useState(localStorage.getItem('edge_tts_url') || '');

  // -- Data / DB State --
  const [dbStatus, setDbStatus] = useState<{ connected: boolean, permission: string, name: string | null }>({ connected: false, permission: 'none', name: null });
  const importFileRef = useRef<HTMLInputElement>(null);

  // -- Archive State --
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');

  useEffect(() => {
     if (isOpen) {
        if (initialTab === 'search') setCurrentSection('search');
        else if (initialTab === 'activity') setCurrentSection('data');
        else if (initialTab === 'archives') setCurrentSection('archives');
        else setCurrentSection('general');
        
        checkDbStatus();
        
        try {
            const keys = JSON.parse(localStorage.getItem('gemini_saved_keys') || '[]');
            setSavedKeys(keys);
        } catch (e) { setSavedKeys([]); }

        try {
            const searchKeys = JSON.parse(localStorage.getItem('search_google_key_presets') || '[]');
            setSavedSearchKeys(searchKeys);
        } catch (e) { setSavedSearchKeys([]); }

        try {
            const cp = JSON.parse(localStorage.getItem('custom_api_providers') || '[]');
            setCustomProviders(cp);
        } catch (e) { setCustomProviders([]); }
     }
  }, [isOpen, initialTab]);

  useEffect(() => {
      if (isOpen && currentSection === 'archives') {
          loadArchives();
      }
  }, [isOpen, currentSection]);

  const loadArchives = async () => {
      const all = await storageService.getAllSessions();
      setArchivedSessions(all.filter(s => s.isArchived).sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const checkDbStatus = async () => {
      const connected = storageService.hasFileHandle();
      const name = storageService.getConnectedFileName();
      const permission = await storageService.checkPermissionState();
      setDbStatus({ connected, permission, name });
  };
  
  const handleKeysChange = (newKeys: any[]) => {
      setSavedKeys(newKeys);
      localStorage.setItem('gemini_saved_keys', JSON.stringify(newKeys));
      storageService.triggerAutoSave();
  };

  const handleSearchKeysChange = (newKeys: any[]) => {
      setSavedSearchKeys(newKeys);
      localStorage.setItem('search_google_key_presets', JSON.stringify(newKeys));
      storageService.triggerAutoSave();
  };

  const handleCustomProvidersChange = (newProviders: CustomProvider[]) => {
      setCustomProviders(newProviders);
      localStorage.setItem('custom_api_providers', JSON.stringify(newProviders));
      storageService.triggerAutoSave();
      // Notify components that model list might have changed
      window.dispatchEvent(new Event('gemini-api-key-updated'));
  };

  useEffect(() => {
      window.addEventListener('storage-db-status', checkDbStatus);
      return () => window.removeEventListener('storage-db-status', checkDbStatus);
  }, []);

  const connectedFile = dbStatus.name;
  const permissionGranted = dbStatus.permission === 'granted';

  const handleSaveGeneral = async () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_base_url', baseUrl);
    localStorage.setItem('gemini_custom_instructions', systemInstruction);
    
    // Save Proxy Settings
    localStorage.setItem('global_proxy_enabled', String(proxyEnabled));
    localStorage.setItem('global_proxy_url', proxyUrl);

    resetAI();
    window.dispatchEvent(new Event('gemini-api-key-updated'));
    
    if (apiKey) {
        setConnectionStatus('testing');
        try {
            await testApiKeyConnection(apiKey);
            setConnectionStatus('success');
            setTimeout(() => setConnectionStatus('idle'), 2000);
        } catch (e) {
            setConnectionStatus('failed');
        }
    } else {
       onClose();
    }
  };

  const handleSaveModels = () => {
      localStorage.setItem('ollama_host', ollamaHost);
      localStorage.setItem('ollama_model', ollamaModel);
      localStorage.setItem('aliyun_api_key', aliyunKey);
      localStorage.setItem('aliyun_model', aliyunModel);
      localStorage.setItem('groq_api_key', groqKey);
      localStorage.setItem('groq_model', groqModel);
      localStorage.setItem('siliconflow_api_key', siliconFlowKey);
      localStorage.setItem('siliconflow_model', siliconFlowModel);
      localStorage.setItem('openrouter_api_key', openRouterKey);
      localStorage.setItem('openrouter_model', openRouterModel);
      alert("模型配置已保存");
  };

  const handleSaveSearch = () => {
      localStorage.setItem('search_provider', searchProvider);
      localStorage.setItem('search_google_key', googleSearchKey);
      localStorage.setItem('search_google_cx', googleCx);
      localStorage.setItem('search_tavily_key', tavilyKey);
      localStorage.setItem('search_brave_key', braveKey);
      alert("搜索配置已保存");
  };

  const handleSaveVoice = () => {
      localStorage.setItem('live_model_provider', liveProvider);
      localStorage.setItem('google_tts_key', googleTtsKey);
      localStorage.setItem('edge_tts_url', edgeTtsUrl);
      alert("语音配置已保存");
  };

  // DB Handlers
  const handleConnectFile = async () => {
      try {
          await storageService.connectLocalFile();
      } catch (e: any) {
          if (e.name !== 'AbortError') alert("连接失败: " + e.message);
      }
  };

  const handleCreateFile = async () => {
      try {
          await storageService.createLocalDatabase();
      } catch (e: any) {
          if (e.name !== 'AbortError') alert("创建失败: " + e.message);
      }
  };

  const handleRestorePermission = async () => {
      await storageService.verifyPermission(true);
  };

  const handleExportBackup = async () => {
      const data = await storageService.getBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gemini_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
      importFileRef.current?.click();
  };

  const handleLegacyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const text = await file.text();
          const data = JSON.parse(text);
          await storageService.importData(data);
          alert("导入成功！");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("导入失败，文件格式可能不正确。");
      }
      if (importFileRef.current) importFileRef.current.value = '';
  };

  // Archive Handlers
  const handleRestoreArchive = async (id: string) => {
      await storageService.toggleArchiveSession(id);
      loadArchives();
  };

  const handleDeleteArchive = async (id: string) => {
      if(!confirm("确定要永久删除此对话吗？")) return;
      await storageService.deleteSession(id);
      loadArchives();
  };

  const handleClearArchives = async () => {
      if(!confirm(`确定要清空所有 ${archivedSessions.length} 条归档记录吗？此操作无法撤销。`)) return;
      for (const s of archivedSessions) {
          await storageService.deleteSession(s.id);
      }
      loadArchives();
  };

  const filteredArchives = archivedSessions.filter(s => 
      s.title.toLowerCase().includes(archiveSearch.toLowerCase())
  );

  if (!isOpen) return null;

  const NavItem = ({ id, label, icon: Icon }: any) => (
      <button 
         onClick={() => setCurrentSection(id)}
         className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors w-auto md:w-full whitespace-nowrap md:whitespace-normal flex-shrink-0 ${currentSection === id ? 'bg-blue-50 text-blue-600 border-b-2 md:border-b-0 md:border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
      >
         <Icon className="w-4 h-4 shrink-0" />
         <span>{label}</span>
      </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-4xl h-[95dvh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
         
         {/* Responsive Sidebar */}
         <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-500" />
                    设置
                </h2>
                <button onClick={onClose} className="md:hidden p-2 bg-white rounded-full border border-gray-200 shadow-sm text-gray-500">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            {/* Horizontal Scroll Nav on Mobile */}
            <div className="flex-1 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden no-scrollbar">
                <nav className="flex flex-row md:flex-col p-2 md:p-0 space-x-1 md:space-x-0 md:space-y-1">
                   <NavItem id="general" label="通用 / Gemini" icon={Settings} />
                   <NavItem id="models" label="模型服务商" icon={Server} />
                   <NavItem id="search" label="联网搜索" icon={SearchIcon} />
                   <NavItem id="voice" label="语音与通话" icon={Mic2} />
                   <NavItem id="archives" label="归档管理" icon={Archive} />
                   <NavItem id="data" label="数据与存储" icon={Database} />
                </nav>
            </div>
            
            <div className="p-4 border-t border-gray-200 hidden md:block">
                <button onClick={onClose} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <X className="w-4 h-4" /> 关闭
                </button>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            <div className="p-4 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
                
                {/* --- GENERAL SECTION --- */}
                {currentSection === 'general' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Gemini API 设置</h3>
                            <p className="text-sm text-gray-500 mb-6">配置 Google Gemini 的核心参数。Keys 仅存储在本地。</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">当前 API Key</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <input 
                                            type={showKey ? "text" : "password"}
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="pl-10 block w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                            placeholder="AIzaSy..."
                                        />
                                        <button 
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="mt-1 flex justify-between items-center">
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            获取 API Key <Globe className="w-3 h-3" />
                                        </a>
                                        {connectionStatus === 'testing' && <span className="text-xs text-blue-600 flex items-center gap-1"><RefreshCcw className="w-3 h-3 animate-spin" /> 测试连接...</span>}
                                        {connectionStatus === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> 连接成功</span>}
                                        {connectionStatus === 'failed' && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 连接失败</span>}
                                    </div>
                                </div>
                                
                                {/* New Key Manager */}
                                <KeyManager 
                                    keys={savedKeys} 
                                    onKeysChange={handleKeysChange}
                                    activeKey={apiKey}
                                    onSelect={(key) => { setApiKey(key); alert("已切换 API Key"); }}
                                />

                                {/* Network / Proxy Section */}
                                <div className="border-t border-gray-100 pt-6">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                       <Network className="w-4 h-4 text-blue-600" /> 网络与全局代理 (Global Proxy)
                                    </h4>
                                    
                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                               <span className="text-sm font-medium text-gray-700">启用全局代理</span>
                                               <span className="text-xs text-gray-500">将所有 API 请求 (Gemini/OpenAI) 转发至自定义域名</span>
                                            </div>
                                            <div 
                                                onClick={() => setProxyEnabled(!proxyEnabled)}
                                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${proxyEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                                            >
                                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${proxyEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                            </div>
                                        </div>

                                        {proxyEnabled && (
                                           <div className="animate-[fadeIn_0.2s]">
                                              <label className="block text-xs font-medium text-gray-600 mb-1">代理服务地址 (Proxy Base URL)</label>
                                              <div className="relative">
                                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                      <Server className="w-3.5 h-3.5 text-gray-400" />
                                                  </div>
                                                  <input 
                                                      type="text"
                                                      value={proxyUrl}
                                                      onChange={(e) => setProxyUrl(e.target.value)}
                                                      className="pl-9 w-full rounded border-gray-300 text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="例如: https://my-oneapi.com 或 https://gemini-proxy.vercel.app"
                                                  />
                                              </div>
                                              <div className="mt-2 text-[10px] text-gray-500 space-y-1">
                                                 <p>• <span className="font-semibold text-gray-600">Gemini:</span> 会直接使用此地址作为 baseUrl。</p>
                                                 <p>• <span className="font-semibold text-gray-600">OpenAI Compatible (Groq/SF/Aliyun):</span> 会替换原 API 地址的域名部分 (Host Replacement)。</p>
                                              </div>
                                           </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gemini 专用 Base URL (可选)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Globe className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <input 
                                            type="text"
                                            value={baseUrl}
                                            onChange={(e) => setBaseUrl(e.target.value)}
                                            className="pl-10 block w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                                            placeholder="https://generativelanguage.googleapis.com"
                                            disabled={proxyEnabled}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{proxyEnabled ? "已启用全局代理，此设置被忽略。" : "仅用于 Gemini 服务。默认留空。"}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">系统指令 (System Prompt)</label>
                                    <textarea 
                                        value={systemInstruction}
                                        onChange={(e) => setSystemInstruction(e.target.value)}
                                        rows={3}
                                        className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="例如：你是一个专业的翻译助手..."
                                    />
                                    <p className="mt-1 text-xs text-gray-500">此指令将应用于所有新对话。</p>
                                </div>

                                <div className="pt-4">
                                    <button onClick={handleSaveGeneral} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
                                        <Save className="w-4 h-4" /> 保存并应用
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODELS SECTION --- */}
                {currentSection === 'models' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">模型服务商与自定义接口</h3>
                            <p className="text-sm text-gray-500 mb-6">配置各家 API 服务商，或添加您自己的 OpenAI 兼容接口。</p>

                            <div className="grid gap-6">
                                {/* Custom API Connectors - NEW */}
                                <CustomProviderManager 
                                    providers={customProviders}
                                    onProvidersChange={handleCustomProvidersChange}
                                />

                                {/* Ollama */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><Laptop className="w-4 h-4" /> Ollama (本地)</h4>
                                    <div className="grid gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">Host URL</label>
                                            <input type="text" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="http://localhost:11434" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">默认模型 (Model Name)</label>
                                            <input type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="llama3" />
                                            <PresetManager 
                                               title="预设管理" 
                                               storageKey="ollama_model_presets"
                                               currentValue={ollamaModel}
                                               onSelect={setOllamaModel}
                                               placeholderLabel="别名 (e.g. Qwen)"
                                               placeholderValue="模型ID (e.g. qwen2.5:7b)"
                                               defaultPresets={[
                                                   { name: 'Qwen 2.5 3B', value: 'qwen2.5:3b' },
                                                   { name: 'Qwen 2.5 7B', value: 'qwen2.5:7b' },
                                                   { name: 'Llama 3', value: 'llama3' }
                                               ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* OpenRouter */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><Network className="w-4 h-4" /> OpenRouter (聚合平台)</h4>
                                    <div className="grid gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">API Key</label>
                                            <input type="password" value={openRouterKey} onChange={e => setOpenRouterKey(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="sk-or-..." />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">默认模型</label>
                                            <input type="text" value={openRouterModel} onChange={e => setOpenRouterModel(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="google/gemini-2.0-flash-001" />
                                            <PresetManager 
                                               title="预设管理" 
                                               storageKey="openrouter_model_presets"
                                               currentValue={openRouterModel}
                                               onSelect={setOpenRouterModel}
                                               placeholderLabel="别名"
                                               placeholderValue="模型ID"
                                               defaultPresets={[
                                                   { name: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
                                                   { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
                                                   { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
                                                   { name: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' }
                                               ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SiliconFlow */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" /> SiliconFlow (硅基流动)</h4>
                                    <div className="grid gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">API Key</label>
                                            <input type="password" value={siliconFlowKey} onChange={e => setSiliconFlowKey(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="sk-..." />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">默认模型</label>
                                            <input type="text" value={siliconFlowModel} onChange={e => setSiliconFlowModel(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="deepseek-ai/DeepSeek-R1" />
                                            <PresetManager 
                                               title="预设管理" 
                                               storageKey="siliconflow_model_presets"
                                               currentValue={siliconFlowModel}
                                               onSelect={setSiliconFlowModel}
                                               placeholderLabel="别名"
                                               placeholderValue="模型ID"
                                               defaultPresets={[
                                                   { name: 'DeepSeek-R1', value: 'deepseek-ai/DeepSeek-R1' },
                                                   { name: 'DeepSeek-V3', value: 'deepseek-ai/DeepSeek-V3' },
                                                   { name: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' }
                                               ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Groq */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Groq Cloud</h4>
                                    <div className="grid gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">API Key</label>
                                            <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="gsk_..." />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">默认模型</label>
                                            <input type="text" value={groqModel} onChange={e => setGroqModel(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="llama-3.3-70b-versatile" />
                                            <PresetManager 
                                               title="预设管理" 
                                               storageKey="groq_model_presets"
                                               currentValue={groqModel}
                                               onSelect={setGroqModel}
                                               placeholderLabel="别名"
                                               placeholderValue="模型ID"
                                               defaultPresets={[
                                                   { name: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
                                                   { name: 'Mixtral 8x7b', value: 'mixtral-8x7b-32768' },
                                                   { name: 'Gemma 2 9B', value: 'gemma2-9b-it' }
                                               ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Aliyun */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><Cloud className="w-4 h-4" /> 阿里云 DashScope</h4>
                                    <div className="grid gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">API Key</label>
                                            <input type="password" value={aliyunKey} onChange={e => setAliyunKey(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="sk-..." />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">默认模型</label>
                                            <input type="text" value={aliyunModel} onChange={e => setAliyunModel(e.target.value)} className="w-full mt-1 rounded border-gray-300 text-sm p-2" placeholder="qwen-plus" />
                                            <PresetManager 
                                               title="预设管理" 
                                               storageKey="aliyun_model_presets"
                                               currentValue={aliyunModel}
                                               onSelect={setAliyunModel}
                                               placeholderLabel="别名"
                                               placeholderValue="模型ID"
                                               defaultPresets={[
                                                   { name: 'Qwen Plus', value: 'qwen-plus' },
                                                   { name: 'Qwen Max', value: 'qwen-max' },
                                                   { name: 'Qwen Turbo', value: 'qwen-turbo' }
                                               ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4">
                                <button onClick={handleSaveModels} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
                                    <Save className="w-4 h-4" /> 保存所有内置模型配置
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SEARCH SECTION --- */}
                {currentSection === 'search' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">联网搜索配置</h3>
                            <p className="text-sm text-gray-500 mb-6">设置 Web Search 功能使用的搜索引擎。</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">默认搜索引擎</label>
                                    <div className="flex gap-4">
                                        {[SearchProvider.GOOGLE, SearchProvider.TAVILY, SearchProvider.BRAVE].map(p => (
                                            <button 
                                                key={p}
                                                onClick={() => setSearchProvider(p)}
                                                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${searchProvider === p ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                            >
                                                {p === SearchProvider.GOOGLE ? 'Google Custom' : (p === SearchProvider.TAVILY ? 'Tavily AI' : 'Brave Search')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {searchProvider === SearchProvider.GOOGLE && (
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Google Search API Key</label>
                                            <input type="password" value={googleSearchKey} onChange={e => setGoogleSearchKey(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" />
                                        </div>
                                        
                                        {/* Key Manager for Google Search */}
                                        <KeyManager 
                                            keys={savedSearchKeys} 
                                            onKeysChange={handleSearchKeysChange}
                                            activeKey={googleSearchKey}
                                            onSelect={(key) => { setGoogleSearchKey(key); alert("已切换 Search API Key"); }}
                                        />

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Search Engine ID (CX)</label>
                                            <input type="text" value={googleCx} onChange={e => setGoogleCx(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" />
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            需在 Google Cloud Console 启用 Custom Search API 并创建搜索引擎。当 API 返回配额不足 (429/403) 错误时，系统会自动尝试切换到下一个预设 Key。
                                        </div>
                                    </div>
                                )}

                                {searchProvider === SearchProvider.TAVILY && (
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Tavily API Key</label>
                                            <input type="password" value={tavilyKey} onChange={e => setTavilyKey(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" placeholder="tvly-..." />
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            专为 LLM 设计的搜索引擎。注册 Tavily 获取 Key (有免费额度)。
                                        </div>
                                    </div>
                                )}

                                {searchProvider === SearchProvider.BRAVE && (
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Brave Search API Key</label>
                                            <input type="password" value={braveKey} onChange={e => setBraveKey(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" />
                                        </div>
                                    </div>
                                )}
                                
                                <div className="pt-2">
                                    <button onClick={handleSaveSearch} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
                                        <Save className="w-4 h-4" /> 保存搜索配置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VOICE SECTION --- */}
                {currentSection === 'voice' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">语音与实时通话</h3>
                            <p className="text-sm text-gray-500 mb-6">配置 TTS (文本转语音) 和 Live API 参数。</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Live Mode Provider</label>
                                    <select 
                                        value={liveProvider}
                                        onChange={(e) => setLiveProvider(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white"
                                    >
                                        <option value="gemini_native">Gemini Native (Multimodal Live API)</option>
                                        <option value="groq">Groq (Whisper + Llama + PlayAI)</option>
                                        <option value="gemini_tts">Simulated (Edge TTS)</option>
                                    </select>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                    <h4 className="font-medium text-gray-800 flex items-center gap-2"><Volume2 className="w-4 h-4" /> TTS 服务配置</h4>
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Google Cloud TTS Key (可选)</label>
                                        <input type="password" value={googleTtsKey} onChange={e => setGoogleTtsKey(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" />
                                        <p className="text-[10px] text-gray-500 mt-1">若留空，默认使用 Microsoft Edge TTS (免费)。</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Edge TTS URL (可选)</label>
                                        <input type="text" value={edgeTtsUrl} onChange={e => setEdgeTtsUrl(e.target.value)} className="w-full rounded border-gray-300 text-sm p-2" placeholder="ws://localhost:7890" />
                                        <p className="text-[10px] text-gray-500 mt-1">用于连接本地 Edge TTS 转发服务。留空使用默认 Bing 接口。</p>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button onClick={handleSaveVoice} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
                                        <Save className="w-4 h-4" /> 保存语音配置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ARCHIVES SECTION --- */}
                {currentSection === 'archives' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">已归档的对话</h3>
                            <p className="text-sm text-gray-500 mb-6">管理或恢复已归档的历史记录。</p>

                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    placeholder="搜索归档..." 
                                    value={archiveSearch}
                                    onChange={(e) => setArchiveSearch(e.target.value)}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                                />
                                {archivedSessions.length > 0 && (
                                    <button 
                                        onClick={handleClearArchives}
                                        className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                                    >
                                        清空归档
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {filteredArchives.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        {archiveSearch ? '未找到匹配的归档' : '暂无归档记录'}
                                    </div>
                                ) : (
                                    filteredArchives.map(session => (
                                        <div key={session.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-200 transition-all group">
                                            <div className="flex flex-col min-w-0 flex-1 mr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Archive className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <span className="font-medium text-gray-800 truncate">{session.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(session.createdAt).toLocaleDateString()}
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    {session.messages.length} 条消息
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleRestoreArchive(session.id)}
                                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="恢复对话"
                                                >
                                                    <ArchiveRestore className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteArchive(session.id)}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="永久删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DATA SECTION --- */}
                {currentSection === 'data' && (
                    <div className="space-y-8 animate-[fadeIn_0.3s]">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">数据存储与备份</h3>
                            <p className="text-sm text-gray-500 mb-6">管理您的本地数据库文件和导入/导出。</p>

                            {/* Database Connection Status */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2"><HardDrive className="w-4 h-4" /> 本地数据库文件</h4>
                                
                                {dbStatus.connected ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
                                            <Database className="w-5 h-5" />
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">已连接文件</div>
                                                <div className="text-xs opacity-80 break-all font-mono mt-0.5">{connectedFile}</div>
                                            </div>
                                            {permissionGranted ? (
                                                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full font-bold">读写正常</span>
                                            ) : (
                                                <button onClick={handleRestorePermission} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 hover:bg-orange-200 font-bold animate-pulse">
                                                    恢复授权
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-start gap-1.5">
                                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>此文件包含您的所有聊天记录、设置和密钥。所有数据变更会自动实时同步写入。</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 gap-4">
                                        <Database className="w-10 h-10 text-gray-300" />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-gray-700">暂未连接本地数据库文件</p>
                                            <p className="text-xs text-gray-500 mt-1">数据仅存储在浏览器缓存 (IndexedDB) 中，清除缓存可能会丢失。</p>
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-3">
                                            <button onClick={handleCreateFile} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors">新建数据库文件</button>
                                            <button onClick={handleConnectFile} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">连接已有文件</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Import / Export */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3 mb-3 text-gray-800">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Download className="w-5 h-5" /></div>
                                        <span className="font-medium text-sm">手动备份</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4 h-10">导出当前所有数据的 JSON 备份文件 (快照)。</p>
                                    <button onClick={handleExportBackup} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                                        下载备份 (.json)
                                    </button>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3 mb-3 text-gray-800">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Upload className="w-5 h-5" /></div>
                                        <span className="font-medium text-sm">数据导入</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4 h-10">从 JSON 备份文件恢复数据 (将覆盖/合并现有数据)。</p>
                                    <button onClick={handleImportJSON} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                                        选择文件导入
                                    </button>
                                    <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleLegacyFileChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
         </div>
      </div>
    </div>
  );
};
