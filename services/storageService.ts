
import { ChatSession, FileSystemFileHandle, Bookmark, SearchHistoryItem } from '../types';

const DB_NAME = 'gemini-clone-db';
const STORE_NAME = 'sessions';
const CONFIG_STORE = 'config'; // New store for file handles
const BOOKMARKS_STORE = 'bookmarks';
const SEARCH_HISTORY_STORE = 'search_history';
const DB_VERSION = 4; // Bump version to ensure config store is created

// Keys from localStorage that should be synced
const SETTINGS_KEYS = [
  'gemini_api_key', 'gemini_saved_keys', 'gemini_custom_instructions', 'gemini_base_url',
  'global_proxy_enabled', 'global_proxy_url',
  'ollama_model', 'ollama_host', 'ollama_api_key', 'ollama_model_presets',
  'aliyun_api_key', 'aliyun_model', 'aliyun_model_presets',
  'groq_api_key', 'groq_model', 'groq_model_presets',
  'siliconflow_api_key', 'siliconflow_model', 'siliconflow_image_model', 'siliconflow_audio_model', 'siliconflow_voice', 'siliconflow_model_presets', 'siliconflow_image_presets',
  'openrouter_api_key', 'openrouter_model', 'openrouter_model_presets', // Added OpenRouter
  'search_provider', 'search_google_key', 'search_google_key_presets', 'search_google_cx', 'search_tavily_key', 'search_brave_key', 'search_summary_model',
  'edge_tts_url', 'google_tts_key',
  'live_model_provider',
  'playai_api_key', 'playai_user_id', 'playai_voice_id'
];

interface BackupData {
  version: number;
  timestamp: number;
  sessions: ChatSession[];
  bookmarks: Bookmark[];
  searchHistory: SearchHistoryItem[];
  settings: Record<string, string>;
}

class StorageService {
  private db: IDBDatabase | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private saveTimeout: any = null;
  private initPromise: Promise<void>;
  private isSyncing: boolean = false; // Lock to prevent overwriting file during load

  constructor() {
    this.initPromise = this.initDB().then(() => this.loadHandleFromDB());
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB error:", event);
        reject('Database error');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(CONFIG_STORE)) {
          db.createObjectStore(CONFIG_STORE);
        }

        if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const store = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('url', 'url', { unique: false });
        }

        if (!db.objectStoreNames.contains(SEARCH_HISTORY_STORE)) {
          const store = db.createObjectStore(SEARCH_HISTORY_STORE, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // --- File System Access API Integration ---

  public getConnectedFileName(): string | null {
    return this.fileHandle ? this.fileHandle.name : null;
  }

  public hasFileHandle(): boolean {
    return !!this.fileHandle;
  }

  // Helper to notify UI of status changes
  private notifyStatusChange() {
     window.dispatchEvent(new Event('storage-db-status'));
  }

  // Persist handle to IDB
  private async saveHandleToDB(handle: FileSystemFileHandle): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readwrite');
      const store = transaction.objectStore(CONFIG_STORE);
      const request = store.put(handle, 'db_handle'); // Singleton key
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Load handle from IDB on startup
  private async loadHandleFromDB(): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CONFIG_STORE], 'readonly');
      const store = transaction.objectStore(CONFIG_STORE);
      const request = store.get('db_handle');
      
      request.onsuccess = async () => {
        if (request.result) {
           this.fileHandle = request.result as FileSystemFileHandle;
           console.log("Restored file handle from DB:", this.fileHandle.name);
           
           // Check initial permission state
           // Note: It will likely be 'prompt' on reload, but we check to be sure
           try {
             const state = await this.checkPermissionState();
             console.log(`Initial DB Permission: ${state}`);
           } catch(e) {}
           
           // Notify UI immediately so the "Reconnect" button appears if needed
           setTimeout(() => this.notifyStatusChange(), 100);
        }
        resolve();
      };
      request.onerror = () => {
         console.warn("Failed to load file handle");
         resolve();
      };
    });
  }

  // Check if we have permission, request if needed (User Gesture Required for request)
  public async verifyPermission(readWrite: boolean = true): Promise<boolean> {
    if (!this.fileHandle) return false;
    
    const opts = { mode: readWrite ? 'readwrite' : 'read' } as any;
    
    try {
      // Check if we already have permission
      if ((await this.fileHandle.queryPermission(opts)) === 'granted') {
        this.notifyStatusChange();
        return true;
      }
      
      // Request permission (Must be called inside a user event handler)
      if ((await this.fileHandle.requestPermission(opts)) === 'granted') {
        this.notifyStatusChange();
        return true;
      }
    } catch (e) {
      console.error("Permission check failed", e);
    }
    
    this.notifyStatusChange();
    return false;
  }

  // Quick check for UI (non-blocking, no request)
  public async checkPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'none'> {
      if (!this.fileHandle) return 'none';
      try {
          return await this.fileHandle.queryPermission({ mode: 'readwrite' });
      } catch {
          return 'denied';
      }
  }

  public async connectLocalFile(): Promise<void> {
    if (typeof (window as any).showOpenFilePicker !== 'function') {
      throw new Error('当前浏览器环境不支持文件系统 API。\n\n如果您正在使用 IP 地址访问 (例如 http://192.168.x.x)，浏览器出于安全原因会禁用此功能。\n\n解决方案：\n1. 使用 Localhost 访问\n2. 配置 HTTPS\n3. Chrome 可尝试开启 flags: chrome://flags/#unsafely-treat-insecure-origin-as-secure');
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'JSON Database File',
          accept: { 'application/json': ['.json'] },
        }],
        multiple: false,
      });

      // LOCK writes while we load data FROM the file
      this.isSyncing = true;
      try {
        this.fileHandle = handle;
        await this.saveHandleToDB(handle); // Persist
        
        // Load data FROM the file INTO the app (IDB).
        await this.syncFromFile();
        console.log(`Connected to local file: ${handle.name}`);
        this.notifyStatusChange();
      } finally {
        this.isSyncing = false; // Unlock writes
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error connecting file:', err);
        throw err;
      }
    }
  }

  public async createLocalDatabase(): Promise<void> {
    if (typeof (window as any).showSaveFilePicker !== 'function') {
      throw new Error('当前浏览器环境不支持文件系统 API。请使用 HTTPS 或 Localhost 访问。');
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `gemini_db_${new Date().toISOString().slice(0, 10)}.json`,
        types: [{
          description: 'JSON Database File',
          accept: { 'application/json': ['.json'] },
        }],
      });

      this.fileHandle = handle;
      await this.saveHandleToDB(handle); // Persist
      
      // For NEW file, we want to write current App state to it immediately.
      await this.saveToDisk();
      
      console.log(`Created local file: ${handle.name}`);
      this.notifyStatusChange();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error creating file:', err);
        throw err;
      }
    }
  }

  // Helper to read file and import
  public async syncFromFile(): Promise<void> {
    if (!this.fileHandle) return;
    
    // Verify read permission
    const hasPerm = await this.verifyPermission(false);
    if (!hasPerm) throw new Error("Permission denied");

    const file = await this.fileHandle.getFile();
    const text = await file.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON file", e);
      if (!text.trim()) data = [];
    }

    await this.importData(data);
  }

  public async importData(data: any): Promise<void> {
    // 1. Array Format = Legacy (Sessions Only)
    if (Array.isArray(data)) {
        await this.importSessions(data);
    } 
    // 2. Object Format = New Full Backup
    else if (typeof data === 'object') {
        if (data.sessions && Array.isArray(data.sessions)) {
            await this.importSessions(data.sessions);
        }
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
            await this.importBookmarks(data.bookmarks);
        }
        if (data.searchHistory && Array.isArray(data.searchHistory)) {
            await this.importSearchHistory(data.searchHistory);
        }
        if (data.settings && typeof data.settings === 'object') {
            this.restoreSettings(data.settings);
        }
    }
  }

  private restoreSettings(settings: Record<string, string>) {
      Object.entries(settings).forEach(([k, v]) => {
          if (typeof v === 'string') localStorage.setItem(k, v);
      });
      // Notify app parts to reload config
      window.dispatchEvent(new Event('gemini-api-key-updated'));
  }

  // Public wrapper to trigger save manually (e.g. from Settings)
  public async triggerAutoSave(): Promise<void> {
      await this.saveToDisk();
  }

  // NEW: Public method to get full backup data object for manual export
  public async getBackupData(): Promise<BackupData> {
    if (!this.db) await this.initPromise;

    const sessions = await this.getAllSessions();
    const bookmarks = await this.getAllBookmarks();
    const searchHistory = await this.getAllSearchHistory();

    const settings: Record<string, string> = {};
    SETTINGS_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) settings[k] = v;
    });

    return {
        version: 3,
        timestamp: Date.now(),
        sessions,
        bookmarks,
        searchHistory,
        settings
    };
  }

  private async saveToDisk() {
    if (!this.fileHandle) return;
    
    // Prevent overwriting the file while we are in the middle of loading from it
    if (this.isSyncing) {
        console.log("Skipping saveToDisk during sync phase");
        return;
    }

    // Debounce saves to avoid hitting disk too frequently on streaming updates
    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    this.saveTimeout = setTimeout(async () => {
      try {
        // Only check permission status (non-blocking) before attempting write
        // We cannot use 'verifyPermission(true)' here because it might prompt, which fails inside setTimeout without user gesture
        // Instead, we query. If denied/prompt, we skip silently (the UI should show a warning indicator)
        const opts = { mode: 'readwrite' };
        
        try {
             if ((await this.fileHandle!.queryPermission(opts as any)) === 'granted') {
                 const backup = await this.getBackupData();

                 const writable = await this.fileHandle!.createWritable();
                 await writable.write(JSON.stringify(backup, null, 2));
                 await writable.close();
                 console.log('Auto-saved full backup to local file.');
                 this.notifyStatusChange(); // Success
            } else {
                 console.warn("Auto-save skipped: Permission not granted yet.");
                 this.notifyStatusChange(); // Status likely 'prompt'
            }
        } catch (e) {
            console.error("Error during permission query or write", e);
            this.notifyStatusChange();
        }
      } catch (err) {
        console.error('Failed to auto-save to disk:', err);
      }
    }, 1000); // 1 second debounce
  }

  // --- Core CRUD ---

  public async saveSession(session: ChatSession): Promise<void> {
    if (!this.db) await this.initPromise; // Wait for init
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // 1. Get existing first to preserve metadata
      const getRequest = store.get(session.id);
      
      getRequest.onsuccess = () => {
         const existing = getRequest.result as ChatSession | undefined;
         
         const finalSession = { ...session };
         
         // Preserve flags if they exist in DB but are missing/undefined in the update payload
         if (existing) {
            if (finalSession.isPinned === undefined) finalSession.isPinned = existing.isPinned;
            if (finalSession.isArchived === undefined) finalSession.isArchived = existing.isArchived;
            if (finalSession.pinnedIndex === undefined) finalSession.pinnedIndex = existing.pinnedIndex;
            // Preserve creation date if somehow missing
            if (!finalSession.createdAt) finalSession.createdAt = existing.createdAt;
         }

         const putRequest = store.put(finalSession);
         
         putRequest.onsuccess = () => {
            this.saveToDisk(); // Trigger auto-save to file
            resolve();
         };
         putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  public async getSession(id: string): Promise<ChatSession | undefined> {
    if (!this.db) await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllSessions(): Promise<ChatSession[]> {
    if (!this.db) await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll(); // Get all to sort in memory for complex sort

      request.onsuccess = (event) => {
        let results: ChatSession[] = (event.target as IDBRequest).result || [];
        
        // Sort: Pinned first (by index), then Unpinned (by Date)
        results.sort((a, b) => {
          // Explicitly cast undefined/null to false for consistent sorting
          const pinA = !!a.isPinned;
          const pinB = !!b.isPinned;
          
          if (pinA !== pinB) {
            return pinA ? -1 : 1; // Pinned (true) comes first
          }
          
          // If both are pinned, sort by pinnedIndex (ascending)
          if (pinA && pinB) {
             const idxA = a.pinnedIndex !== undefined ? a.pinnedIndex : Number.MAX_SAFE_INTEGER;
             const idxB = b.pinnedIndex !== undefined ? b.pinnedIndex : Number.MAX_SAFE_INTEGER;
             return idxA - idxB;
          }

          // If neither are pinned, sort by updatedAt (newest first)
          return b.updatedAt - a.updatedAt;
        });

        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async togglePinSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    if (session) {
      const nextState = !session.isPinned;
      
      let newSession = { ...session, isPinned: nextState };
      
      if (nextState) {
         const all = await this.getAllSessions();
         const pinned = all.filter(s => s.isPinned);
         newSession.pinnedIndex = 0; 
         for (let i = 0; i < pinned.length; i++) {
            pinned[i].pinnedIndex = i + 1;
            await this.saveSession(pinned[i]);
         }
      } else {
         newSession.pinnedIndex = undefined;
      }

      await this.saveSession(newSession);
    }
  }

  public async reorderPinnedSessions(orderedSessions: ChatSession[]): Promise<void> {
     // Save each session with its new index based on the array order
     for (let i = 0; i < orderedSessions.length; i++) {
        const s = orderedSessions[i];
        if (s.pinnedIndex !== i) {
           s.pinnedIndex = i;
           await this.saveSession(s);
        }
     }
  }

  public async toggleArchiveSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    if (session) {
      session.isArchived = !session.isArchived;
      await this.saveSession(session);
    }
  }

  public async updateSessionTitle(id: string, newTitle: string): Promise<void> {
    const session = await this.getSession(id);
    if (session) {
      session.title = newTitle;
      await this.saveSession(session);
    }
  }

  public async deleteSession(id: string): Promise<void> {
    if (!this.db) await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.saveToDisk(); // Trigger auto-save
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async clearAll(): Promise<void> {
    if (!this.db) await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        // Also clear other stores for full reset
        const tx2 = this.db!.transaction([BOOKMARKS_STORE, SEARCH_HISTORY_STORE], 'readwrite');
        tx2.objectStore(BOOKMARKS_STORE).clear();
        tx2.objectStore(SEARCH_HISTORY_STORE).clear();
        
        tx2.oncomplete = () => {
            this.saveToDisk(); // Trigger auto-save (will write empty array)
            resolve();
        };
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async importSessions(sessions: ChatSession[]): Promise<void> {
    if (!this.db) await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      sessions.forEach(session => {
        store.put(session);
      });
    });
  }

  // --- Bookmarks CRUD ---

  public async addBookmark(bookmark: Bookmark): Promise<void> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([BOOKMARKS_STORE], 'readwrite');
      const store = tx.objectStore(BOOKMARKS_STORE);
      const req = store.put(bookmark);
      req.onsuccess = () => {
          this.saveToDisk();
          resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async removeBookmark(id: string): Promise<void> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([BOOKMARKS_STORE], 'readwrite');
      const store = tx.objectStore(BOOKMARKS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => {
          this.saveToDisk();
          resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllBookmarks(): Promise<Bookmark[]> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
       const tx = this.db!.transaction([BOOKMARKS_STORE], 'readonly');
       const store = tx.objectStore(BOOKMARKS_STORE);
       const req = store.getAll();
       req.onsuccess = () => {
          // Sort by creation time desc by default
          const res = (req.result || []) as Bookmark[];
          res.sort((a, b) => b.createdAt - a.createdAt);
          resolve(res);
       };
       req.onerror = () => reject(req.error);
    });
  }
  
  public async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([BOOKMARKS_STORE], 'readwrite');
      const store = tx.objectStore(BOOKMARKS_STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      bookmarks.forEach(b => store.put(b));
    });
  }

  // --- Search History CRUD ---

  public async addSearchHistory(query: string): Promise<void> {
    if (!this.db) await this.initPromise;
    
    // Check duplication? Ideally yes, update timestamp.
    const all = await this.getAllSearchHistory();
    const existing = all.find(h => h.query.toLowerCase() === query.toLowerCase());
    
    const item: SearchHistoryItem = {
       id: existing ? existing.id : Date.now().toString(),
       query: query,
       timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
       const tx = this.db!.transaction([SEARCH_HISTORY_STORE], 'readwrite');
       const store = tx.objectStore(SEARCH_HISTORY_STORE);
       const req = store.put(item);
       req.onsuccess = () => {
           this.saveToDisk();
           resolve();
       };
       req.onerror = () => reject(req.error);
    });
  }

  public async removeSearchHistory(id: string): Promise<void> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
       const tx = this.db!.transaction([SEARCH_HISTORY_STORE], 'readwrite');
       const store = tx.objectStore(SEARCH_HISTORY_STORE);
       const req = store.delete(id);
       req.onsuccess = () => {
           this.saveToDisk();
           resolve();
       };
       req.onerror = () => reject(req.error);
    });
  }

  public async clearSearchHistory(): Promise<void> {
     if (!this.db) await this.initPromise;
     return new Promise((resolve, reject) => {
        const tx = this.db!.transaction([SEARCH_HISTORY_STORE], 'readwrite');
        const store = tx.objectStore(SEARCH_HISTORY_STORE);
        const req = store.clear();
        req.onsuccess = () => {
            this.saveToDisk();
            resolve();
        };
        req.onerror = () => reject(req.error);
     });
  }

  public async getAllSearchHistory(): Promise<SearchHistoryItem[]> {
     if (!this.db) await this.initPromise;
     return new Promise((resolve, reject) => {
        const tx = this.db!.transaction([SEARCH_HISTORY_STORE], 'readonly');
        const store = tx.objectStore(SEARCH_HISTORY_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
           const res = (req.result || []) as SearchHistoryItem[];
           // Sort new to old
           res.sort((a, b) => b.timestamp - a.timestamp);
           resolve(res);
        };
        req.onerror = () => reject(req.error);
     });
  }
  
  public async importSearchHistory(history: SearchHistoryItem[]): Promise<void> {
    if (!this.db) await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([SEARCH_HISTORY_STORE], 'readwrite');
      const store = tx.objectStore(SEARCH_HISTORY_STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      history.forEach(h => store.put(h));
    });
  }
}

export const storageService = new StorageService();
