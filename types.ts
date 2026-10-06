
export interface SearchSource {
  uri: string;
  title: string;
}

export interface InlineData {
  mimeType: string;
  data: string;
}

export interface ContextFile {
  id: string;
  name: string;
  type: string;
  size: number;
  handle?: any; // FileSystemFileHandle - using any to avoid strict DOM type issues in some envs
  base64: string; // Cache content
  textContent?: string; // Extracted text content (for PDFs/Docs) to enable analysis by all models
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string; // Track which model generated this message
  thinking?: string; // DeepSeek-R1 Reasoning Content
  images?: string[]; // For UI rendering (legacy/convenience)
  videos?: string[]; // URL for generated videos
  audios?: string[]; // Base64 or Blob URL for generated audio
  files?: { name: string; type: string; url?: string }[]; // Metadata for non-image files UI
  inlineData?: InlineData[]; // Store base64 data for Context Memory (History)
  searchSources?: SearchSource[];
  timestamp: number;
  isError?: boolean;
  isStreaming?: boolean;
  latency?: number; // Duration in milliseconds
}

export enum ModelType {
  FLASH = 'gemini-2.5-flash',
  FLASH_LITE = 'gemini-2.5-flash-lite',
  PRO = 'gemini-3-pro-preview',
  PRO_THINKING = 'gemini-3-pro-preview-thinking', // Internal key for Thinking Config
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  PRO_IMAGE = 'gemini-3-pro-image-preview',
  VEO = 'veo-3.1-fast-generate-preview',
  TTS = 'gemini-2.5-flash-preview-tts', // For specific TTS generation
  OLLAMA = 'ollama-local',
  ALIYUN = 'aliyun-api', // Aliyun API type
  GROQ = 'groq-api', // New Groq API type
  SILICONFLOW = 'siliconflow-api', // SiliconFlow API type
  SILICONFLOW_IMAGE = 'siliconflow-image', // SiliconFlow Image Generation
  SILICONFLOW_TTS = 'siliconflow-tts', // SiliconFlow Text-to-Speech
  OPENROUTER = 'openrouter-api', // OpenRouter API type
  GOOGLE_TTS = 'google-cloud-tts', // Google Cloud TTS
  CUSTOM_API = 'custom-api' // Generic OpenAI-compatible custom provider
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export interface ChatSessionConfig {
  model: ModelType;
}

export interface Attachment {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  name: string;
  textContent?: string; // Extracted text for analysis
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  contextFiles?: ContextFile[]; // Persistent files for this session
  createdAt: number;
  updatedAt: number;
  model: ModelType;
  isPinned?: boolean;
  isArchived?: boolean;
  pinnedIndex?: number; // For manual ordering of pinned items
}

export interface UserSettings {
  syncUrl: string; // URL for the remote database
  theme: 'dark' | 'light';
  autoTitle: boolean;
}

// File System Access API Types
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

// --- New Search Types ---
export enum SearchProvider {
  GOOGLE = 'google',
  TAVILY = 'tavily',
  BRAVE = 'brave',
  DUCKDUCKGO = 'duckduckgo'
}

export interface SearchResult {
  title: string;
  url: string;
  content: string; // Snippet or description
  favicon?: string;
  source?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  group?: string; // For grouping (default: "General" or empty)
  createdAt: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}
