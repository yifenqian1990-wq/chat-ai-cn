
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, X, User, Sparkles, StopCircle, Paperclip, Copy, Check, Edit3, RotateCcw, ChevronDown, Zap, Brain, ImageIcon as ImageIconLucide, Palette, Video as VideoIcon, Mic2, Play, Pause, Settings2, TrendingUp, Lightbulb, ExternalLink, RefreshCw, UploadCloud, BookOpen, Loader2, Clock, Wand2, ArrowDown, Lock, Unlock, Info, Code, MapPin, Globe, Music, Gamepad2, GraduationCap, Microscope, Coffee, Plane, Camera, Monitor, HeartPulse, Film, AlertCircle, Printer, ChevronUp, Download, Compass, MessageSquarePlus, Trash2, Ghost, ShieldAlert, Laptop, Cloud, FileText, FileCode, FileSpreadsheet, FileJson, File as FileIconGeneric, Volume2, Cpu, Link as LinkIcon, Eye, FolderOpen, ArrowRight, ScanLine, Plus, Search, Radio, ChevronRight, Network } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ModelType, Attachment, InlineData, SearchSource, ContextFile, CustomProvider } from '../types';
import { createChat, sendMessageStream, connectLiveSession, generateChatTitle, generateTrendingTopics, checkSearchIntent, processSearchResultsWithAI } from '../services/geminiService';
import { performWebSearch } from '../services/searchService';
import { storageService } from '../services/storageService';
import { generateEdgeAudio } from '../services/edgeTtsService'; // Import Edge TTS
import { generateGoogleCloudAudio } from '../services/googleTtsService'; // Import Google TTS
import { Chat, Content, Part, LiveSession } from '@google/genai';
import { VoiceActivityDetector, transcribeAudioWithGroq, generatePlayAiAudio, LiveAudioStreamer } from '../services/liveAudioService';

interface ChatInterfaceProps {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
  isPrivateMode?: boolean; // New Prop
}

// Fallback pool in case API fails
const FALLBACK_TOPICS = [
  { icon: TrendingUp, text: "分析2025年人工智能行业趋势", label: "行业分析", desc: "了解最新的AI技术发展和市场动态" },
  { icon: Code, text: "用 Python 写一个贪吃蛇游戏", label: "代码生成", desc: "生成一个完整的贪吃蛇游戏代码示例" },
  { icon: ImageIconLucide, text: "生成一张赛博朋克风格的未来城市 night 景图", label: "AI 绘画", desc: "创作一幅充满未来感的数字艺术作品" },
  { icon: Brain, text: "解释量子纠缠，就像我五岁一样", label: "科学普及", desc: "用简单的语言解释复杂的物理概念" },
  { icon: Globe, text: "比较一下东京和纽约的生活成本", label: "生活助手", desc: "详细对比两个大城市的居住开销" },
  { icon: Music, text: "写一首关于春天和希望的流行歌曲歌词", label: "创意写作", desc: "激发创作灵感，编写动人歌词" },
  { icon: MapPin, text: "制定一个为期 7 天的日本关西深度游攻略", label: "旅行规划", desc: "规划一次完美的旅行路线和行程" },
  { icon: Film, text: "推荐几部类似《星际穿越》的硬科幻电影", label: "影视娱乐", desc: "寻找高质量的科幻电影佳作" }
];

// Helper to clean Markdown for TTS
const cleanTextForTTS = (text: string) => {
    return text
      .replace(/```[\s\S]*?```/g, "代码块已跳过") // Code blocks
      .replace(/`([^`]+)`/g, "$1") // Inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Images
      .replace(/[*_~`#]/g, "") // Markdown symbols
      .replace(/^\s*[-*+]\s+/gm, "") // List bullets
      .replace(/^\s*\d+\.\s+/gm, "") // List numbers
      .replace(/\n\s*\n/g, "\n") // Multiple newlines
      .trim();
};

// 'auto' is an internal UI state, mapped to actual models during send
const AUTO_MODEL_ID = 'auto-select';

const MODEL_OPTIONS = [
  { 
    id: AUTO_MODEL_ID, 
    name: '自动选择 (Auto)', 
    desc: '智能匹配最佳模型', 
    icon: Wand2, 
    badge: '免费', 
    badgeColor: 'green',
    details: '根据提示词自动路由：简单任务用 Flash，复杂推理用 Pro，画图用 Image。最省心的选择。'
  },
  { 
    id: ModelType.FLASH, 
    name: 'Gemini 2.5 Flash', 
    desc: '快速、多功能、支持搜索', 
    icon: Zap, 
    badge: '免费', 
    badgeColor: 'green',
    details: 'Google 综合性价比最高的模型。速度快，延迟低，支持实时 Google 搜索。'
  },
  { 
    id: ModelType.FLASH_LITE, 
    name: 'Gemini 2.5 Flash Lite', 
    desc: '极速响应', 
    icon: Zap, 
    badge: '免费', 
    badgeColor: 'green',
    details: '极致轻量化，专为低成本和毫秒级响应设计。适合简单聊天。'
  },
  { 
    id: ModelType.PRO, 
    name: 'Gemini 3.0 Pro', 
    desc: '深度推理、复杂任务', 
    icon: Brain, 
    badge: '免费', 
    badgeColor: 'green',
    details: '擅长处理复杂的指令、编码、数学和逻辑推理任务。推理能力强。'
  },
  { 
    id: ModelType.PRO_THINKING, 
    name: 'Gemini 3.0 Pro (Thinking)', 
    desc: '深度思考模式', 
    icon: Brain, 
    badge: '免费', 
    badgeColor: 'green',
    details: '启用思维链 (CoT)，在回答前进行深度思考。回答速度较慢，但逻辑更严密。'
  },
  { 
    id: ModelType.OPENROUTER, 
    name: 'OpenRouter (Claude/Gemini)', 
    desc: 'OpenRouter/Claude/Gemini', 
    icon: Network, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: '接入 OpenRouter 聚合平台。支持 Claude 3.5, Gemini 2.0, DeepSeek 等模型。需配置 API Key。'
  },
  { 
    id: ModelType.GROQ, 
    name: 'Groq (Llama/Mixtral)', 
    desc: 'Groq/Llama3/Mixtral', 
    icon: Zap, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: 'Groq Cloud 超高速推理。支持 Llama 3, Mixtral 等模型。需配置 API Key。'
  },
  { 
    id: ModelType.ALIYUN, 
    name: 'Aliyun (Qwen/DeepSeek)', 
    desc: '阿里云/通义千问', 
    icon: Cloud, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: '调用阿里云 DashScope API。支持通义千问 (qwen-plus, qwen-max) 及 DeepSeek-R1 等模型。需配置 API Key。'
  },
  { 
    id: ModelType.SILICONFLOW, 
    name: 'SiliconFlow (DeepSeek)', 
    desc: '硅基流动/DeepSeek', 
    icon: Cpu, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: '调用硅基流动 (SiliconFlow) API。支持 DeepSeek R1/V3, Qwen 等高性能开源模型。需配置 API Key。'
  },
  { 
    id: ModelType.SILICONFLOW_IMAGE, 
    name: 'SiliconFlow Image (Flux)', 
    desc: '硅基流动/Flux生图', 
    icon: ImageIconLucide, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: '调用 SiliconFlow 生图 API (如 Flux.1)。需配置 API Key。'
  },
  { 
    id: ModelType.SILICONFLOW_TTS, 
    name: 'SiliconFlow TTS (Fish)', 
    desc: '硅基流动/语音合成', 
    icon: Volume2, 
    badge: 'API', 
    badgeColor: 'orange', 
    details: '调用 SiliconFlow 语音 API (如 Fish Audio)。需配置 API Key。'
  },
  { 
    id: ModelType.OLLAMA, 
    name: 'Ollama (Local / Cloud)', 
    desc: '本地/远程模型 (支持搜索)', 
    icon: Laptop, 
    badge: '自定义', 
    badgeColor: 'green',
    details: '连接本地或远程的 Ollama 服务。支持 Gemini 辅助联网搜索 (RAG)，让本地模型也能获取实时信息。'
  },
  { 
    id: ModelType.FLASH_IMAGE, 
    name: 'Gemini 2.5 Flash Image', 
    desc: '生成图像', 
    icon: ImageIconLucide, 
    badge: '免费', 
    badgeColor: 'green',
    details: '标准文生图模型。生成速度快，支持 1:1, 16:9 等比例。不支持调节分辨率。'
  },
  { 
    id: ModelType.PRO_IMAGE, 
    name: 'Gemini 3.0 Pro Image', 
    desc: '高分辨率图像', 
    icon: Palette, 
    badge: '需付费账户', 
    badgeColor: 'orange',
    details: '生成高质量、细节丰富的图像。支持 1K, 2K, 4K 分辨率设置。**需绑定 Billing 账户**。'
  },
  { 
    id: ModelType.VEO, 
    name: 'Veo 3.1 Video', 
    desc: '生成视频', 
    icon: VideoIcon, 
    badge: '需付费账户', 
    badgeColor: 'orange',
    details: '生成 720p 视频片段。生成时间较长(1-2分钟)。**需绑定 Billing 账户**。'
  },
  { 
    id: ModelType.TTS, 
    name: 'Gemini TTS', 
    desc: '文本转语音', 
    icon: Mic2, 
    badge: '免费', 
    badgeColor: 'green',
    details: '将文本转换为自然流畅的语音。支持多种音色。'
  },
];

// Configuration for providers that support sub-models (Presets)
const PROVIDER_CONFIG: Record<string, {
  storageKey: string;
  presetsKey: string;
  defaults: {name: string, value: string}[];
}> = {
  [ModelType.OPENROUTER]: {
    storageKey: 'openrouter_model',
    presetsKey: 'openrouter_model_presets',
    defaults: [
       { name: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
       { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
       { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
       { name: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' }
    ]
  },
  [ModelType.GROQ]: {
    storageKey: 'groq_model',
    presetsKey: 'groq_model_presets',
    defaults: [
       { name: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
       { name: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
       { name: 'Mixtral 8x7b', value: 'mixtral-8x7b-32768' },
       { name: 'Gemma 2 9B', value: 'gemma2-9b-it' }
    ]
  },
  [ModelType.OLLAMA]: {
    storageKey: 'ollama_model',
    presetsKey: 'ollama_model_presets',
    defaults: [
       { name: 'Qwen 2.5 3B', value: 'qwen2.5:3b' },
       { name: 'Qwen 2.5 7B', value: 'qwen2.5:7b' },
       { name: 'Llama 3', value: 'llama3' },
       { name: 'Mistral', value: 'mistral' }
    ]
  },
  [ModelType.ALIYUN]: {
    storageKey: 'aliyun_model',
    presetsKey: 'aliyun_model_presets',
    defaults: [
       { name: 'Qwen Plus', value: 'qwen-plus' },
       { name: 'Qwen Max', value: 'qwen-max' },
       { name: 'Qwen Turbo', value: 'qwen-turbo' },
       { name: 'DeepSeek R1', value: 'deepseek-r1' },
       { name: 'DeepSeek V3', value: 'deepseek-v3' }
    ]
  },
  [ModelType.SILICONFLOW]: {
    storageKey: 'siliconflow_model',
    presetsKey: 'siliconflow_model_presets',
    defaults: [
       { name: 'DeepSeek-R1', value: 'deepseek-ai/DeepSeek-R1' },
       { name: 'DeepSeek-V3', value: 'deepseek-ai/DeepSeek-V3' },
       { name: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
       { name: 'Qwen 2.5 7B', value: 'Qwen/Qwen2.5-7B-Instruct' }
    ]
  },
  [ModelType.SILICONFLOW_IMAGE]: {
    storageKey: 'siliconflow_image_model',
    presetsKey: 'siliconflow_image_presets',
    defaults: [
       { name: 'Flux.1 Schnell', value: 'black-forest-labs/FLUX.1-schnell' },
       { name: 'Flux.1 Dev', value: 'black-forest-labs/FLUX.1-dev' },
       { name: 'SD 3.5 Large', value: 'stabilityai/stable-diffusion-3-5-large' }
    ]
  }
};

// Helper components...
async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
     // @ts-ignore
     if (typeof window !== 'undefined' && window.pdfjsLib) {
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
           const page = await pdf.getPage(i);
           const content = await page.getTextContent();
           // @ts-ignore
           const strings = content.items.map(item => item.str);
           text += strings.join(" ") + "\n";
        }
        return text;
     }
  } catch (e) {
     console.error("PDF Extraction Error", e);
  }
  return ""; 
}

const CodeBlock = ({ className, children, inline }: any) => {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="bg-gray-100 text-[#c5221f] px-1.5 py-0.5 rounded text-sm font-mono break-all">
        {children}
      </code>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden my-4 border border-gray-200 shadow-sm group/code">
      <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 flex justify-between items-center">
        <span className="uppercase">{language || 'CODE'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gray-500 hover:text-[#1a73e8] transition-colors"
          title="复制"
        >
          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="text-[10px]">{isCopied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <code className={`${className} block bg-[#fafafa] p-4 text-sm overflow-x-auto text-gray-800 font-mono leading-relaxed`}>
        {children}
      </code>
    </div>
  );
};

const AudioPlayer: React.FC<{ src: string, autoPlay?: boolean }> = ({ src, autoPlay = false }) => {
   const [playing, setPlaying] = useState(false);
   const audioRef = useRef<HTMLAudioElement | null>(null);

   useEffect(() => {
     if (audioRef.current) {
        audioRef.current.onended = () => setPlaying(false);
        if (autoPlay) {
            audioRef.current.play().then(() => setPlaying(true)).catch(e => console.log("Autoplay blocked", e));
        }
     }
   }, [src, autoPlay]);

   const togglePlay = () => {
      if (!audioRef.current) return;
      if (playing) {
         audioRef.current.pause();
      } else {
         audioRef.current.play();
      }
      setPlaying(!playing);
   };

   const audioSrc = src.startsWith('data:') ? src : `data:audio/mp3;base64,${src}`;

   return (
      <div className="flex items-center gap-3 bg-gray-100 rounded-full px-3 py-2 w-fit mt-2 animate-[fadeIn_0.3s]">
         <button onClick={togglePlay} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 text-[#1a73e8]">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
         </button>
         <div className="h-1 w-24 bg-gray-300 rounded-full overflow-hidden">
             <div className={`h-full bg-[#1a73e8] ${playing ? 'animate-pulse' : 'w-0'}`} style={{width: playing ? '100%' : '0%'}}></div>
         </div>
         <audio ref={audioRef} src={audioSrc} className="hidden" />
      </div>
   );
};

const getFileIcon = (mimeType: string, fileName: string) => {
   if (mimeType.includes('pdf')) return FileText;
   if (mimeType.includes('image')) return ImageIconLucide;
   if (mimeType.includes('csv') || fileName.endsWith('.csv') || fileName.endsWith('.xlsx')) return FileSpreadsheet;
   if (mimeType.includes('json') || fileName.endsWith('.json')) return FileJson;
   if (mimeType.includes('text') || fileName.endsWith('.txt')) return FileIconGeneric;
   return FileIconGeneric;
};

const CitationTooltip = ({ filename, page }: { filename: string, page: string }) => {
   const Icon = getFileIcon('application/pdf', filename); 
   return (
      <div className="relative inline-block group ml-0.5 align-baseline cursor-help">
         <span className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 text-[10px] font-medium border border-gray-200 transition-colors select-none">
            <span className="max-w-[80px] truncate">{filename}</span>
         </span>
         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 p-2 opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible z-50 pointer-events-none">
            <div className="flex items-start gap-2">
               <div className="p-1.5 bg-red-50 text-red-500 rounded shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
               </div>
               <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{filename}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{page.replace(/_/g, ' ')}</div>
               </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white"></div>
         </div>
      </div>
   );
};

const SourceReferences = ({ sources }: { sources: SearchSource[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  const uniqueDomains = Array.from(new Set(sources.map(s => {
    try { return new URL(s.uri).hostname; } catch { return ''; }
  }))).filter(Boolean).slice(0, 5);

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 print:hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-all rounded-lg group border border-transparent hover:border-gray-200"
      >
         <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
            <div className="flex items-center gap-2">
               <div className="p-1 bg-white border border-gray-200 rounded-md shadow-sm group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" />
               </div>
               <span>搜索来源</span>
               <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{sources.length}</span>
            </div>
            {!isOpen && uniqueDomains.length > 0 && (
               <div className="flex -space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {uniqueDomains.map(d => (
                     <img 
                        key={d} 
                        src={`https://www.google.com/s2/favicons?domain=${d}&sz=32`}
                        className="w-4 h-4 rounded-full border border-white bg-white"
                        alt={d}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                     />
                  ))}
               </div>
            )}
         </div>
         <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 px-1 animate-[fadeIn_0.2s]">
            {sources.map((source, idx) => (
               <a 
                  key={idx} 
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group/card"
               >
                  <div className="flex-shrink-0 mt-0.5 text-xs font-bold text-gray-400 w-5 h-5 flex items-center justify-center bg-gray-100 rounded group-hover/card:bg-blue-100 group-hover/card:text-blue-600 transition-colors">
                     {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight group-hover/card:text-blue-700 transition-colors">
                        {source.title}
                     </div>
                     <div className="flex items-center gap-1.5 mt-1">
                        <img 
                           src={`https://www.google.com/s2/favicons?domain=${new URL(source.uri).hostname}&sz=32`}
                           className="w-3 h-3 opacity-60"
                           onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">
                           {new URL(source.uri).hostname}
                        </div>
                     </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-300 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0 mt-1" />
               </a>
            ))}
         </div>
      )}
    </div>
  );
};

const MessageBubble = ({ 
   msg, editingMessageId, setEditingMessageId, editContent, setEditContent, saveEdit, handleRegenerate, handleDeleteMessage, formatMessageWithSources, idx, setPreviewImage, handleTTS, ttsLoadingId, playingMessageId, modelOptions
}: any) => {
   const isUser = msg.role === 'user';
   const [isCopied, setIsCopied] = useState(false);
   
   const getModelName = (modelId?: string) => {
      if (!modelId || modelId === AUTO_MODEL_ID) return null;
      const m = modelOptions.find((opt: any) => opt.id === modelId);
      return m ? m.name.replace('Gemini ', '').replace(' (Thinking)', '').replace('Ollama (Local / Cloud)', 'Ollama').replace('Aliyun (Qwen/DeepSeek)', 'Aliyun').replace('Groq (Llama/Mixtral)', 'Groq').replace('SiliconFlow (DeepSeek)', 'SiliconFlow').replace('OpenRouter (Claude/Gemini)', 'OpenRouter') : null;
   };

   const isThinking = msg.role === 'model' && msg.isStreaming && !msg.text && !msg.thinking;

   const handleCopy = () => {
      navigator.clipboard.writeText(msg.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
   };

   const isPlaying = playingMessageId === msg.id;

   return (
      <div className={`flex w-full mb-2 group/row ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
         <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isUser ? 'ml-3 bg-[#1a73e8]' : 'mr-3 bg-white border border-gray-200'}`}>
            {isUser ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-[#1a73e8]" />}
         </div>
         <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-3 shadow-sm relative group/bubble w-fit text-sm leading-relaxed overflow-hidden ${isUser ? 'bg-[#1a73e8] text-white rounded-2xl rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm'}`}>
               {((msg.images && msg.images.length > 0) || (msg.files && msg.files.length > 0)) && (
                  <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                     {msg.images?.map((img: string, i: number) => (
                        <div key={`img-${i}`} className="relative cursor-pointer group/img" onClick={() => setPreviewImage(img)}>
                           <img src={img} className="max-w-full md:max-w-xs max-h-64 rounded-lg border border-white/20 hover:opacity-90 transition-opacity object-cover" />
                        </div>
                     ))}
                     {msg.files?.map((file: any, i: number) => {
                        const Icon = getFileIcon(file.type, file.name);
                        return (
                           <div key={`file-${i}`} className={`flex items-center gap-2 p-2 rounded-lg max-w-xs border ${isUser ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
                              <Icon className="w-4 h-4 shrink-0" />
                              <div className="truncate text-xs font-medium" title={file.name}>{file.name}</div>
                           </div>
                        );
                     })}
                  </div>
               )}
               {msg.videos && msg.videos.map((vid: string, i: number) => (
                  <video key={i} src={vid} controls className="max-w-full md:max-w-sm rounded-lg mb-2 bg-black" />
               ))}
               {msg.audios && msg.audios.map((aud: string, i: number) => (
                  <AudioPlayer key={i} src={aud} autoPlay={false} />
               ))}
               {editingMessageId === msg.id ? (
                  <div className="w-full min-w-[300px]">
                     <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white text-gray-800 text-sm"
                        rows={3}
                     />
                     <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setEditingMessageId(null)} className="px-3 py-1 text-xs bg-white text-gray-600 hover:bg-gray-100 rounded border border-gray-300">取消</button>
                        <button onClick={() => saveEdit(msg.id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">保存</button>
                     </div>
                  </div>
               ) : (
                  isUser ? <div className="whitespace-pre-wrap">{msg.text}</div> : (
                     isThinking ? (
                        <div className="flex flex-col gap-2 w-full min-w-[200px] py-1">
                           <div className="h-3 bg-gray-100 rounded w-full animate-pulse"></div>
                           <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                           <div className="h-3 bg-gray-100 rounded w-5/6 animate-pulse"></div>
                        </div>
                     ) : (
                        msg.isError ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-red-600">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span className="whitespace-pre-wrap text-sm">{msg.text || "生成时发生错误"}</span>
                                </div>
                                <button onClick={() => handleRegenerate(idx)} className="text-xs text-red-500 hover:underline w-fit">重试</button>
                            </div>
                        ) : (
                            <div className="relative markdown-body-wrapper">
                                {msg.thinking && (
                                   <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
                                      <div className="px-3 py-1.5 bg-gray-100/50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 uppercase tracking-wide">
                                         <Brain className="w-3 h-3" />
                                         <span>Thinking Process</span>
                                      </div>
                                      <div className="p-3 text-[10px] text-gray-600 font-mono leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto custom-scrollbar">
                                         {msg.thinking}
                                      </div>
                                   </div>
                                )}
                                {msg.text && (
                                  <div className="markdown-body">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                          p: ({children}) => <p className="mb-3 leading-7 text-gray-800 tracking-normal last:mb-0">{children}</p>,
                                          a: ({href, children, ...props}) => {
                                            if (href && href.startsWith('CITATION:')) {
                                               const parts = href.split(':');
                                               return <CitationTooltip filename={parts[1] || 'Unknown'} page={parts.slice(2).join(' ') || ''} />;
                                            }
                                            // Small Superscript Link Style for citations [1]
                                            if (typeof children === 'string' && /^\[\d+\]$/.test(children)) {
                                                const num = children.replace('[', '').replace(']', '');
                                                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#1a73e8] hover:underline align-super text-[10px] ml-0.5 transition-colors" title={`来源 ${num}`}>{children}</a>;
                                            }
                                            return <a href={href} target="_blank" className="text-blue-600 hover:underline" {...props}>{children}</a>
                                          },
                                          code: CodeBlock,
                                      }}
                                    >
                                      {formatMessageWithSources(msg) + (msg.isStreaming && !msg.thinking ? ' ▍' : '')}
                                    </ReactMarkdown>
                                  </div>
                                )}
                                {msg.searchSources && msg.searchSources.length > 0 && <SourceReferences sources={msg.searchSources} />}
                            </div>
                        )
                     )
                  )
               )}
            </div>
            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover/row:opacity-100 transition-opacity px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
               {isUser && !editingMessageId && (
                  <>
                     <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.text); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                     <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="复制">{isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                  </>
               )}
               {!isUser && !msg.isStreaming && !msg.isError && !editingMessageId && (
                  <>
                     <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="复制">{isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                     <button onClick={() => handleRegenerate(idx)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="重新生成"><RotateCcw className="w-3.5 h-3.5" /></button>
                     <button onClick={() => handleTTS(msg.id, msg.text)} className={`p-1.5 rounded-full transition-colors ${ttsLoadingId === msg.id ? 'text-purple-600 bg-purple-50' : isPlaying ? 'text-purple-600 bg-purple-50' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`} title={isPlaying ? "停止朗读" : (msg.audios?.length ? "播放语音" : "生成并朗读")} disabled={ttsLoadingId === msg.id}>
                        {ttsLoadingId === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                     </button>
                     {msg.model && getModelName(msg.model) && <span className="ml-2 text-[10px] text-gray-400 select-none border border-gray-200 rounded px-1.5 py-0.5">{getModelName(msg.model)}</span>}
                  </>
               )}
            </div>
         </div>
      </div>
   );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, onSessionCreated, isPrivateMode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<(Attachment)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>(AUTO_MODEL_ID);
  const [sessionMeta, setSessionMeta] = useState<{title: string, createdAt: number} | null>(null);
  const [displayedTopics, setDisplayedTopics] = useState<any[]>([]);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [modelToast, setModelToast] = useState<{name: string, desc: string} | null>(null);
  const [isSearchEnabled, setIsSearchEnabled] = useState(true);
  const [searchResultCount, setSearchResultCount] = useState<number>(5);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioMsgIdRef = useRef<string | null>(null); 
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageSize, setImageSize] = useState("1K");
  const [showSettings, setShowSettings] = useState(false);
  const [subModel, setSubModel] = useState<string>('');
  const [subModelOptions, setSubModelOptions] = useState<{name: string, value: string}[]>([]);
  
  // Custom API Logic
  const [customModelOptions, setCustomModelOptions] = useState<any[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  // Ref for Groq Live VAD and MediaRecorder
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const liveStreamerRef = useRef<LiveAudioStreamer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const groqLiveActiveRef = useRef<boolean>(false);
 
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const lastSavedStateRef = useRef<string>('');
  const loadedSessionIdRef = useRef<string | null>(null);
  const [apiKeyVersion, setApiKeyVersion] = useState(0);

  // Dynamic Models List merging built-in and custom
  const allModelOptions = useMemo(() => {
     return [...MODEL_OPTIONS, ...customModelOptions];
  }, [customModelOptions]);

  const updateCustomModels = useCallback(() => {
      try {
          const cp = JSON.parse(localStorage.getItem('custom_api_providers') || '[]');
          const options = cp.map((p: CustomProvider) => ({
              id: p.id,
              name: p.name,
              desc: `自定义接口 / ${p.defaultModel}`,
              icon: LinkIcon,
              badge: '自定义',
              badgeColor: 'blue',
              details: `连接到您的自定义 OpenAI 兼容接口。\n地址: ${p.baseUrl}\n模型: ${p.defaultModel}`,
              isCustom: true,
              config: p
          }));
          setCustomModelOptions(options);
      } catch (e) { setCustomModelOptions([]); }
  }, []);

  useEffect(() => {
    updateCustomModels();
    const handleUpdate = () => {
        updateCustomModels();
        setApiKeyVersion(v => v + 1);
    };
    window.addEventListener('gemini-api-key-updated', handleUpdate);
    return () => window.removeEventListener('gemini-api-key-updated', handleUpdate);
  }, [updateCustomModels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    if (isModelMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelMenuOpen]);

  useEffect(() => {
     return () => {
        if (activeAudioRef.current) {
           activeAudioRef.current.pause();
           activeAudioRef.current = null;
        }
     };
  }, []);

  useEffect(() => {
    if ((!sessionId || messages.length === 0) && displayedTopics.length === 0) {
       handleRefreshTopics(); 
    }
  }, [sessionId, messages.length]);

  const handleRefreshTopics = async () => {
     setIsTopicsLoading(true);
     try {
         const topics = await generateTrendingTopics();
         setDisplayedTopics(topics);
     } catch (e) {
         const shuffled = [...FALLBACK_TOPICS].sort(() => 0.5 - Math.random());
         setDisplayedTopics(shuffled.slice(0, 8));
     } finally {
         setIsTopicsLoading(false);
     }
  };

  const getIconForTopic = (type?: string) => {
      switch (type) {
          case 'code': return Code;
          case 'image': return ImageIconLucide;
          case 'brain': return Brain;
          case 'globe': return Globe;
          case 'music': return Music;
          case 'camera': return Camera;
          case 'plane': return Plane;
          case 'coffee': return Coffee;
          case 'trend': return TrendingUp;
          case 'zap': return Zap;
          default: return TrendingUp;
      }
  };

  useEffect(() => {
    loadedSessionIdRef.current = null;
    if (activeAudioRef.current) {
       activeAudioRef.current.pause();
       activeAudioRef.current = null;
       setPlayingMessageId(null);
       lastAudioMsgIdRef.current = null; 
    }

    const loadSession = async () => {
      if (isPrivateMode) {
         setMessages([]);
         setContextFiles([]);
         setSessionMeta({ title: '私密对话', createdAt: Date.now() });
         chatSessionRef.current = createChat(ModelType.FLASH, undefined, { useGoogleSearch: isSearchEnabled });
         setAutoScrollEnabled(true);
         lastSavedStateRef.current = '';
         loadedSessionIdRef.current = 'private'; 
         return;
      }

      if (sessionId) {
        const session = await storageService.getSession(sessionId);
        if (session) {
          const loadedModel = session.model || AUTO_MODEL_ID;
          setMessages(session.messages);
          setContextFiles(session.contextFiles || []);
          setCurrentModel(loadedModel);
          setSessionMeta({ title: session.title, createdAt: session.createdAt });
          
          lastSavedStateRef.current = JSON.stringify({
            messages: session.messages,
            contextFiles: session.contextFiles || [],
            model: loadedModel,
            title: session.title
          });

          const geminiHistory = prepareHistoryForGemini(session.messages);
          const baseModel = loadedModel === AUTO_MODEL_ID ? ModelType.FLASH : (loadedModel as ModelType);
          chatSessionRef.current = createChat(baseModel, geminiHistory, {
             imageAspectRatio: aspectRatio,
             imageSize: imageSize,
             useGoogleSearch: isSearchEnabled
          }, session.contextFiles);
          
          setAutoScrollEnabled(true);
          setTimeout(() => scrollToBottom(), 100);
        }
      } else {
        setMessages([]);
        setContextFiles([]);
        setSessionMeta(null);
        chatSessionRef.current = createChat(ModelType.FLASH, undefined, { useGoogleSearch: isSearchEnabled });
        setAutoScrollEnabled(true);
        lastSavedStateRef.current = '';
      }
      loadedSessionIdRef.current = sessionId;
    };
    loadSession();
  }, [sessionId, isPrivateMode]);

  useEffect(() => {
    if (isPrivateMode) return;
    if (loadedSessionIdRef.current !== sessionId) return;

    if (sessionId) {
       const isStreaming = messages.some(m => m.isStreaming);
       if (!isStreaming) {
          (async () => {
              const existingSession = await storageService.getSession(sessionId);
              const title = sessionMeta?.title || existingSession?.title || (messages.length > 0 ? messages[0].text.trim().split('\n')[0].slice(0, 30) : 'New Chat');
              const currentHash = JSON.stringify({ messages, contextFiles, model: currentModel, title });

              if (currentHash === lastSavedStateRef.current) return;

              const createdAt = sessionMeta?.createdAt || Date.now();
              await storageService.saveSession({
                  id: sessionId,
                  title,
                  messages,
                  contextFiles, 
                  createdAt,
                  updatedAt: Date.now(),
                  model: currentModel as ModelType,
                  isPinned: existingSession?.isPinned, 
                  isArchived: existingSession?.isArchived, 
                  pinnedIndex: existingSession?.pinnedIndex 
              });
              lastSavedStateRef.current = currentHash;
              if (!sessionMeta) setSessionMeta({ title, createdAt });
          })();
       }
    }
  }, [messages, contextFiles, sessionId, currentModel, sessionMeta, isPrivateMode]);

  useEffect(() => {
    const actualModel = currentModel === AUTO_MODEL_ID ? ModelType.FLASH : (currentModel as ModelType);
    if (currentModel === ModelType.PRO_IMAGE || currentModel === ModelType.VEO) setShowSettings(true);
    
    const info = allModelOptions.find(m => m.id === currentModel);
    if (info) {
       setModelToast({ name: info.name, desc: info.desc });
       const timer = setTimeout(() => setModelToast(null), 3000);
       return () => clearTimeout(timer);
    }

    const config = PROVIDER_CONFIG[currentModel];
    if (config) {
       try {
           const storedPresets = localStorage.getItem(config.presetsKey);
           const options = storedPresets ? JSON.parse(storedPresets) : config.defaults;
           setSubModelOptions(options);
           
           const current = localStorage.getItem(config.storageKey);
           if (current) {
              setSubModel(current);
           } else if (options.length > 0) {
              setSubModel(options[0].value);
              localStorage.setItem(config.storageKey, options[0].value);
           }
       } catch(e) { console.error(e); }
    } else {
       setSubModelOptions([]);
       setSubModel('');
    }

    if (chatSessionRef.current) {
      const geminiHistory = prepareHistoryForGemini(messages);
      chatSessionRef.current = createChat(actualModel, geminiHistory, {
         imageAspectRatio: aspectRatio,
         imageSize: imageSize,
         useGoogleSearch: isSearchEnabled
      }, contextFiles);
    } 
  }, [currentModel, aspectRatio, imageSize, isPrivateMode, apiKeyVersion, isSearchEnabled, contextFiles, allModelOptions]);

  useEffect(() => {
    const div = scrollContainerRef.current;
    if (autoScrollEnabled && div) div.scrollTop = div.scrollHeight; 
  }, [messages, autoScrollEnabled]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= 80; 
      if (!isAtBottom && autoScrollEnabled) setAutoScrollEnabled(false);
      setShowScrollBottomBtn(!isAtBottom);
    }
  };

  const scrollToBottom = () => {
     setAutoScrollEnabled(true);
     if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  };

  useEffect(() => {
     if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
     }
  }, [input]);

  const prepareHistoryForGemini = (msgs: Message[]): Content[] => {
    return msgs.filter(m => !m.isError && !m.isStreaming).map(m => {
        const parts: Part[] = [];
        if (m.inlineData && m.inlineData.length > 0) {
          m.inlineData.forEach(data => parts.push({ inlineData: { mimeType: data.mimeType, data: data.data } }));
        } else if (m.images && m.images.length > 0) {
           m.images.forEach(imgStr => {
              if (imgStr.includes('base64,')) {
                 const [meta, data] = imgStr.split(',');
                 const mimeMatch = meta.match(/:(.*?);/);
                 if (mimeMatch) parts.push({ inlineData: { mimeType: mimeMatch[1], data: data } });
              }
           });
        }
        if (m.text) parts.push({ text: m.text });
        return { role: m.role, parts: parts };
      });
  };

  const addContextFile = (file: ContextFile) => {
      setContextFiles(prev => [...prev, file]);
      setIsContextPanelOpen(true);
  };
  const removeContextFile = (id: string) => setContextFiles(prev => prev.filter(f => f.id !== id));
  const openContextFile = (file: ContextFile) => {
      try {
         const cleanBase64 = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
         const byteCharacters = atob(cleanBase64);
         const byteNumbers = new Array(byteCharacters.length);
         for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
         const byteArray = new Uint8Array(byteNumbers);
         const blob = new Blob([byteArray], {type: file.type});
         const url = URL.createObjectURL(blob);
         window.open(url, '_blank');
      } catch (e) { console.error("Failed to open file", e); alert("无法打开文件预览"); }
  };

  const readFileContent = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const result = e.target?.result as string;
              if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts')) {
                  if (!result.startsWith('data:')) resolve(btoa(unescape(encodeURIComponent(result))));
                  else resolve(result);
              } else {
                  resolve(result);
              }
          };
          reader.onerror = reject;
          if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|py|c|cpp|h|java|html|css|xml|yaml)$/i)) reader.readAsText(file);
          else reader.readAsDataURL(file);
      });
  };

  const processFiles = (files: File[], isPersistentContext: boolean = false) => {
      const unsupportedFiles: string[] = [];
      Array.from(files).forEach(async file => {
         try {
             const base64 = await readFileContent(file);
             const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|py|c|cpp|h|java|html|css|xml|yaml)$/i);
             const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
             const mimeType = file.type || (isText ? 'text/plain' : 'application/octet-stream');
             let extractedText: string | undefined;
             if (isText) {
                 extractedText = decodeURIComponent(escape(atob(base64.includes(',') ? base64.split(',')[1] : base64)));
             } else if (isPdf) {
                 try {
                     const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
                     const binaryString = atob(cleanBase64);
                     const bytes = new Uint8Array(binaryString.length);
                     for(let i=0; i<binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                     extractedText = await extractPdfText(bytes.buffer);
                 } catch (err) { console.error("PDF Decode Error", err); }
             }
             if (isPersistentContext) {
                addContextFile({ id: Date.now().toString() + Math.random().toString().slice(2), name: file.name, type: mimeType, size: file.size, base64: base64, textContent: extractedText, timestamp: Date.now() });
             } else {
                setAttachments(prev => [...prev, { base64: base64, textContent: extractedText, mimeType: mimeType, name: file.name, file: file, previewUrl: mimeType.startsWith('image/') ? base64 : '' }]);
             }
         } catch (e) { console.error(e); unsupportedFiles.push(file.name); }
      });
      if (unsupportedFiles.length > 0) alert(`以下文件读取失败:\n\n${unsupportedFiles.join('\n')}`);
  };

  const handleConnectLocalFile = async () => {
      if ('showOpenFilePicker' in window) {
          try {
              // @ts-ignore
              const handles = await window.showOpenFilePicker({ multiple: true, types: [ { description: 'All Files', accept: { '*/*': [] } } ] });
              for (const handle of handles) {
                  const file = await handle.getFile();
                  const base64 = await readFileContent(file);
                  let extractedText: string | undefined;
                  const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|py|c|cpp|h|java|html|css|xml|yaml)$/i);
                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                  if (isText) extractedText = decodeURIComponent(escape(atob(base64.includes(',') ? base64.split(',')[1] : base64)));
                  else if (isPdf) {
                      try {
                          const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
                          const binaryString = atob(cleanBase64);
                          const bytes = new Uint8Array(binaryString.length);
                          for(let i=0; i<binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                          extractedText = await extractPdfText(bytes.buffer);
                      } catch (err) { console.error("PDF Handle Decode Error", err); }
                  }
                  addContextFile({ id: Date.now().toString() + Math.random().toString().slice(2), name: handle.name, type: file.type || 'application/octet-stream', size: file.size, base64: base64, textContent: extractedText, handle: handle, timestamp: Date.now() });
              }
          } catch (err: any) { if (err.name !== 'AbortError') { console.error(err); alert("无法连接本地文件"); } }
      } else { contextFileInputRef.current?.click(); }
  };

  const handleScanContextFiles = async () => {
    if (contextFiles.length === 0) return;
    setIsScanning(true);
    const updatedFiles = [...contextFiles];
    let processedCount = 0;
    for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|py|c|cpp|h|java|html|css|xml|yaml|sql|env)$/i);
        if ((isPdf || isText) && !file.textContent) {
            try {
                const cleanBase64 = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
                let extractedText = "";
                if (isPdf) {
                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for(let j=0; j<binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                    extractedText = await extractPdfText(bytes.buffer);
                } else { extractedText = decodeURIComponent(escape(atob(cleanBase64))); }
                if (extractedText) { updatedFiles[i] = { ...file, textContent: extractedText }; processedCount++; }
            } catch (e) { console.error(`Failed to scan file ${file.name}`, e); }
        }
    }
    if (processedCount > 0) { setContextFiles(updatedFiles); alert(`扫描完成：已提取 ${processedCount} 个文件的文本内容。`); } 
    else { alert("扫描完成：所有支持的文件均已包含文本内容。"); }
    setIsScanning(false);
  };

  const detectBestModel = (text: string, attachments: Attachment[]): ModelType => {
    const lower = text.toLowerCase();
    if (lower.match(/(画|绘|生成|create|generate|draw).*(图片|image|picture|photo|painting)/i) || lower.match(/^(画|draw|paint)\s/i)) return lower.includes('高清') || lower.includes('4k') || lower.includes('high quality') ? ModelType.PRO_IMAGE : ModelType.FLASH_IMAGE;
    if (lower.match(/(视频|video|movie|clip)/i) && lower.match(/(生成|create|make)/i)) return ModelType.VEO;
    if (lower.length > 300 || lower.match(/(复杂|complex|reasoning|分析|analyze|code|代码|solve|数学|math)/i)) return ModelType.PRO;
    if (lower.match(/^(读一下|说一下|tts|speak|say)/i)) return ModelType.TTS;
    return ModelType.FLASH;
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
     e.preventDefault(); e.stopPropagation(); setIsDragging(false);
     const contextPanel = document.getElementById('context-panel-dropzone');
     const isContextDrop = contextPanel && contextPanel.contains(e.target as Node);
     if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        const fileHandles = []; const files = [];
        for (const item of items) {
            const dtItem = item as any;
            if (isContextDrop && 'getAsFileSystemHandle' in dtItem) {
                // @ts-ignore
                const handle = await dtItem.getAsFileSystemHandle();
                if (handle && handle.kind === 'file') { fileHandles.push(handle); continue; }
            }
            const file = dtItem.getAsFile();
            if (file) files.push(file);
        }
        if (isContextDrop) {
            for (const handle of fileHandles) {
                const file = await handle.getFile();
                const base64 = await readFileContent(file);
                let extractedText: string | undefined;
                const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|py|c|cpp|h|java|html|css|xml|yaml)$/i);
                const isPdf = file.type === 'application/pdf';
                if (isText) extractedText = decodeURIComponent(escape(atob(base64.includes(',') ? base64.split(',')[1] : base64)));
                else if (isPdf) {
                    const binaryString = atob(base64.includes(',') ? base64.split(',')[1] : base64);
                    const bytes = new Uint8Array(binaryString.length);
                    for(let i=0; i<binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                    extractedText = await extractPdfText(bytes.buffer);
                }
                addContextFile({ id: Date.now().toString() + Math.random().toString().slice(2), name: handle.name, type: file.type || 'application/octet-stream', size: file.size, base64: base64, textContent: extractedText, handle: handle, timestamp: Date.now() });
            }
            if (files.length > 0) processFiles(files, true);
        } else {
            if (files.length > 0) processFiles(files, false);
        }
     } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (isContextDrop) processFiles(Array.from(e.dataTransfer.files), true);
        else processFiles(Array.from(e.dataTransfer.files), false);
     }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
              const file = items[i].getAsFile();
              if (file) files.push(file);
          }
      }
      if (files.length > 0) {
          e.preventDefault();
          processFiles(files, false);
      }
  };

  const handleTTS = async (msgId: string, rawText: string) => {
     const text = cleanTextForTTS(rawText);
     if (playingMessageId === msgId) {
         if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
         lastAudioMsgIdRef.current = null; setPlayingMessageId(null); return; 
     }
     if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
     lastAudioMsgIdRef.current = null; setPlayingMessageId(null); setTtsLoadingId(msgId);
     const playAudio = (base64Data: string) => {
        if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
        const audio = new Audio(base64Data.startsWith('data:') ? base64Data : `data:audio/mp3;base64,${base64Data}`);
        audio.onended = () => { setPlayingMessageId(null); if (activeAudioRef.current === audio) { activeAudioRef.current = null; lastAudioMsgIdRef.current = null; } };
        audio.onerror = (e) => { console.error("Audio playback error", e); setPlayingMessageId(null); setTtsLoadingId(null); lastAudioMsgIdRef.current = null; activeAudioRef.current = null; alert("音频播放失败"); };
        activeAudioRef.current = audio; lastAudioMsgIdRef.current = msgId;
        audio.play().then(() => { setPlayingMessageId(msgId); setTtsLoadingId(null); }).catch(e => { console.error("Autoplay blocked", e); setTtsLoadingId(null); });
     };
     const msgIndex = messages.findIndex(m => m.id === msgId); const msg = messages[msgIndex];
     if (msg && msg.audios && msg.audios.length > 0) { playAudio(msg.audios[msg.audios.length - 1]); return; }
     try {
        let audioBlob: Blob | string; const googleKey = localStorage.getItem('google_tts_key');
        if (googleKey && googleKey.length > 5) {
            audioBlob = await generateGoogleCloudAudio(text, googleKey); const base64Audio = `data:audio/mp3;base64,${audioBlob}`;
            setMessages(prev => prev.map(m => { if (m.id === msgId) { const existingAudios = m.audios || []; return { ...m, audios: [...existingAudios, base64Audio] }; } return m; })); playAudio(base64Audio);
        } else {
            const blob = await generateEdgeAudio(text); const reader = new FileReader(); reader.readAsDataURL(blob);
            reader.onloadend = () => { const base64data = reader.result as string; setMessages(prev => prev.map(m => { if (m.id === msgId) { const existingAudios = m.audios || []; return { ...m, audios: [...existingAudios, base64data] }; } return m; })); playAudio(base64data); };
        }
     } catch (e: any) {
        console.warn("TTS Failed", e); setTtsLoadingId(null);
        try {
            const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; const voices = window.speechSynthesis.getVoices();
            const zhVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Microsoft')) && v.lang.includes('zh')) || voices.find(v => v.lang.includes('zh'));
            if (zhVoice) utterance.voice = zhVoice; utterance.onstart = () => setPlayingMessageId(msgId); utterance.onend = () => setPlayingMessageId(null); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
        } catch (nativeErr) { console.error("Native TTS Failed", nativeErr); alert("语音生成失败: 无法调用 TTS 服务。"); }
     }
  };

  const handleLiveStart = async () => {
     try {
       setIsLiveActive(true);
       const liveProvider = localStorage.getItem('live_model_provider');
       
       if (liveProvider === 'groq') {
           groqLiveActiveRef.current = true;
           const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
           setAudioContext(ac);
           const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
           const vad = new VoiceActivityDetector(ac);
           vadRef.current = vad;
           const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
           mediaRecorderRef.current = mediaRecorder;
           audioChunksRef.current = [];
           mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
           vad.onSpeechStart = () => { audioChunksRef.current = []; if (mediaRecorder.state === 'inactive') mediaRecorder.start(); };
           vad.onSpeechEnd = async () => {
              if (mediaRecorder.state === 'recording') { mediaRecorder.stop(); await new Promise(r => setTimeout(r, 100)); }
              if (audioChunksRef.current.length === 0) return;
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              if (!groqLiveActiveRef.current) return;
              try {
                  const text = await transcribeAudioWithGroq(audioBlob);
                  if (!text.trim()) return;
                  const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text, timestamp: Date.now() };
                  setMessages(prev => [...prev, userMsg]);
                  const model = (localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile') as ModelType;
                  const aiMsgId = (Date.now()+1).toString();
                  setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '...', isStreaming: true, timestamp: Date.now() }]);
                  const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
                  history.push({ role: 'user', parts: [{ text: text }] });
                  const chat = createChat(ModelType.GROQ, history, undefined, contextFiles);
                  const responseStream = await sendMessageStream(chat, text, [], ModelType.GROQ, { specificModelName: model });
                  let fullText = "";
                  for await (const chunk of responseStream) { if (chunk.text) fullText += chunk.text; }
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText, isStreaming: false } : m));
                  try {
                      const audioBlob = await generatePlayAiAudio(fullText);
                      const audioUrl = URL.createObjectURL(audioBlob);
                      const audio = new Audio(audioUrl);
                      vad.stop();
                      audio.onended = () => { if (groqLiveActiveRef.current) vad.start(stream); };
                      audio.play();
                  } catch (e) { console.error(e); vad.start(stream); }
              } catch (e) { console.error(e); }
           };
           vad.start(stream);
       } else {
           // Default to Gemini Live API with PCM handling
           const ac = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000}); setAudioContext(ac);
           const playQueue: AudioBuffer[] = []; let isPlaying = false; let nextStartTime = 0;
           const playNext = () => {
              if (playQueue.length === 0) { isPlaying = false; return; } isPlaying = true; const buffer = playQueue.shift()!;
              const source = ac.createBufferSource(); source.buffer = buffer; source.connect(ac.destination);
              const currentTime = ac.currentTime; if (nextStartTime < currentTime) nextStartTime = currentTime + 0.06;
              source.start(nextStartTime); nextStartTime += buffer.duration; source.onended = () => playNext();
            };
           const session = await connectLiveSession(
              async (base64) => {
                 try {
                     const binary = atob(base64); const len = binary.length; const bytes = new Uint8Array(len);
                     for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                     const int16 = new Int16Array(bytes.buffer); const float32 = new Float32Array(int16.length);
                     for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;
                     const audioBuffer = ac.createBuffer(1, float32.length, 24000); audioBuffer.getChannelData(0).set(float32);
                     playQueue.push(audioBuffer); if (!isPlaying) playNext();
                 } catch (e) { console.error("PCM Decode Error", e); }
              },
              () => setIsLiveActive(false), (err) => { console.error(err); let msg = "连接中断"; if (err instanceof Error) msg = err.message; else if (err?.type === 'error') msg = "WebSocket 连接失败。"; alert("Live API Error: " + msg); setIsLiveActive(false); }
           );
           liveSessionRef.current = session;

           // Start streaming microphone to Gemini Live API
           const streamer = new LiveAudioStreamer(ac, (base64) => {
               if (liveSessionRef.current) {
                   liveSessionRef.current.sendRealtimeInput({
                       audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                   });
               }
           });
           await streamer.start(stream);
           liveStreamerRef.current = streamer;
       }
     } catch (e: any) { console.error(e); alert("无法启动 Live API: " + e.message); setIsLiveActive(false); }
  };

  const handleLiveStop = () => { 
      groqLiveActiveRef.current = false;
      if (liveSessionRef.current && liveSessionRef.current.close) liveSessionRef.current.close();
      if (vadRef.current) vadRef.current.stop();
      if (liveStreamerRef.current) liveStreamerRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
      setIsLiveActive(false); 
  };

  const handleSend = async (textOverride?: string, historyOverride?: Message[]) => {
    const userText = textOverride !== undefined ? textOverride : input.trim();
    if ((!userText && attachments.length === 0) || isLoading) return;
    const currentHistory = historyOverride || messages;
    const isNewChat = currentHistory.length === 0;
    const createdAt = sessionMeta?.createdAt || Date.now();
    setInput(''); setAttachments([]); setAutoScrollEnabled(true); if (textareaRef.current) textareaRef.current.style.height = 'auto';
    let currentId = sessionId;
    if (!currentId) { currentId = Date.now().toString(); if (!isPrivateMode) { onSessionCreated(currentId); loadedSessionIdRef.current = currentId; } }
    const updatedContextFiles = [...contextFiles];
    const userInlineData: InlineData[] = [];
    const userFileMetadata: { name: string; type: string; url?: string }[] = [];
    let finalPromptText = userText;
    attachments.forEach(a => {
        if (a.textContent) { finalPromptText += `\n\n--- 文件: ${a.name} ---\n${a.textContent}\n------\n`; userFileMetadata.push({ name: a.name, type: a.mimeType }); } 
        else {
            const base64Data = a.base64.includes('base64,') ? a.base64.split(',')[1] : a.base64;
            userInlineData.push({ mimeType: a.mimeType, data: base64Data });
            if (!a.mimeType.startsWith('image/')) userFileMetadata.push({ name: a.name, type: a.mimeType });
        }
    });
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: userText, images: attachments.filter(a => a.mimeType.startsWith('image/')).map(a => a.base64), files: userFileMetadata, inlineData: userInlineData, timestamp: Date.now() };
    userMessage.text = finalPromptText; 
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessagePlaceholder: Message = { id: aiMessageId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true, model: currentModel === AUTO_MODEL_ID ? undefined : currentModel };
    const newMessages = [...currentHistory, userMessage, aiMessagePlaceholder];
    setMessages(newMessages);
    if (!isPrivateMode) {
        let title = sessionMeta?.title;
        if (!title) { const firstLine = userText.trim().split('\n')[0]; title = firstLine.length > 40 ? firstLine.slice(0, 40) + '...' : firstLine; if (!title && attachments.length > 0) title = `分析 ${attachments[0].name}`; }
        await storageService.saveSession({ id: currentId, title, messages: newMessages, contextFiles: updatedContextFiles, createdAt, updatedAt: Date.now(), model: currentModel as ModelType });
        if (!sessionMeta) setSessionMeta({ title, createdAt });
    } else { if (!sessionMeta) setSessionMeta({ title: '私密对话', createdAt: Date.now() }); }
    setIsLoading(true); const startTime = Date.now(); abortControllerRef.current = new AbortController();
    let effectiveModel = currentModel; 
    try {
      if (effectiveModel === AUTO_MODEL_ID) effectiveModel = detectBestModel(userText, attachments);
      const isGenerationModel = effectiveModel === ModelType.FLASH_IMAGE || effectiveModel === ModelType.PRO_IMAGE || effectiveModel === ModelType.VEO || effectiveModel === ModelType.SILICONFLOW_IMAGE;
      const hasAnalysisAttachments = attachments.some(a => a.mimeType.includes('pdf') || a.textContent || a.mimeType.includes('audio') || a.mimeType.startsWith('video/') || a.mimeType.includes('text'));
      const hasPersistentFiles = contextFiles.length > 0;
      if (isGenerationModel && (hasAnalysisAttachments || hasPersistentFiles)) effectiveModel = ModelType.FLASH;
      
      setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, model: effectiveModel } : msg));
      const geminiHistory = prepareHistoryForGemini(newMessages.slice(0, -2)); 
      
      // Determine task model override logic
      const customProvider = allModelOptions.find(o => o.id === effectiveModel && o.isCustom)?.config;
      let modelTypeForService = ModelType.FLASH;
      if (customProvider) modelTypeForService = ModelType.CUSTOM_API;
      else if (effectiveModel === ModelType.VEO || effectiveModel === ModelType.TTS || effectiveModel === ModelType.OLLAMA || effectiveModel === ModelType.ALIYUN || effectiveModel === ModelType.GROQ || effectiveModel === ModelType.SILICONFLOW || effectiveModel === ModelType.SILICONFLOW_IMAGE || effectiveModel === ModelType.SILICONFLOW_TTS || effectiveModel === ModelType.OPENROUTER) modelTypeForService = effectiveModel as ModelType;

      let fullText = ''; let fullThinking = ''; 
      const collectedSources: SearchSource[] = []; const collectedImages: string[] = []; const collectedVideos: string[] = []; const collectedAudios: string[] = []; const collectedInlineData: InlineData[] = [];
      
      const isGeminiFamily = effectiveModel.startsWith('gemini') || effectiveModel.startsWith('veo');
      const useNativeSearch = isSearchEnabled && isGeminiFamily;
      const useAutoSearchTool = isSearchEnabled && !isGeminiFamily;

      const performRun = async () => {
          chatSessionRef.current = createChat(isGeminiFamily ? effectiveModel as ModelType : ModelType.FLASH, geminiHistory, { 
              imageAspectRatio: aspectRatio, 
              imageSize: imageSize, 
              useGoogleSearch: useNativeSearch, 
              enableAutoSearchTool: useAutoSearchTool 
          }, updatedContextFiles);
          
          const stream = await sendMessageStream(
              chatSessionRef.current, 
              finalPromptText, 
              attachments.filter(a => !a.textContent).map(a => ({base64: a.base64, mimeType: a.mimeType})), 
              modelTypeForService, 
              { 
                  imageAspectRatio: aspectRatio, 
                  imageSize: imageSize, 
                  videoAspectRatio: aspectRatio, 
                  useGoogleSearch: useNativeSearch, 
                  enableAutoSearchTool: useAutoSearchTool,
                  searchResultsCount: searchResultCount, 
                  specificModelName: (effectiveModel === ModelType.GROQ || effectiveModel === ModelType.OLLAMA || effectiveModel === ModelType.SILICONFLOW || effectiveModel === ModelType.ALIYUN || effectiveModel === ModelType.OPENROUTER) ? subModel : undefined,
                  customProvider: customProvider
              }
          );
          
          for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            if (chunk.text) fullText += chunk.text;
            if (chunk.thinking) fullThinking += chunk.thinking;
            if (chunk.groundingMetadata) chunk.groundingMetadata.forEach(s => { if(!collectedSources.some(existing => existing.uri === s.uri)) collectedSources.push(s); });
            if (chunk.generatedImage) { collectedImages.push(chunk.generatedImage); collectedInlineData.push({ mimeType: 'image/png', data: chunk.generatedImage.includes('base64,') ? chunk.generatedImage.split(',')[1] : chunk.generatedImage }); }
            if (chunk.generatedVideo) collectedVideos.push(chunk.generatedVideo);
            if (chunk.generatedAudio) collectedAudios.push(`data:audio/mp3;base64,${chunk.generatedAudio}`);
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: fullText, thinking: fullThinking.length > 0 ? fullThinking : undefined, searchSources: collectedSources.length ? collectedSources : undefined, images: collectedImages.length ? collectedImages : undefined, videos: collectedVideos.length ? collectedVideos : undefined, audios: collectedAudios.length ? collectedAudios : undefined, inlineData: collectedInlineData.length ? collectedInlineData : undefined, model: effectiveModel } : msg));
          }

          if (useAutoSearchTool && fullText.trim()) {
              let toolCall = null;
              try {
                  const clean = fullText.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
                  if (clean.startsWith('{') && clean.endsWith('}')) {
                      const parsed = JSON.parse(clean);
                      if (parsed.tool === 'tavily' && parsed.query) toolCall = parsed;
                  }
              } catch (e) {}

              if (toolCall) {
                  setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `🔍 正在搜索: "${toolCall.query}"...`, isStreaming: true } : msg));
                  let searchContext = "";
                  try {
                      const results = await performWebSearch(toolCall.query, 0, 5);
                      collectedSources.push(...results.map(r => ({ uri: r.url, title: r.title })));
                      searchContext = results.map((r, i) => `[${i+1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n');
                  } catch (e) { searchContext = "Search failed."; }
                  const followUpPrompt = `Search Results for "${toolCall.query}":\n${searchContext}\n\nUser Question: ${userText}\n\nInstructions: Answer the user's question based on the search results. Cite sources as [1], [2] etc.`;
                  fullText = ""; 
                  const stream2 = await sendMessageStream( chatSessionRef.current, followUpPrompt, [], modelTypeForService, { specificModelName: (effectiveModel === ModelType.GROQ || effectiveModel === ModelType.OLLAMA || effectiveModel === ModelType.SILICONFLOW || effectiveModel === ModelType.ALIYUN || effectiveModel === ModelType.OPENROUTER) ? subModel : undefined, customProvider: customProvider } );
                  for await (const chunk of stream2) {
                      if (abortControllerRef.current?.signal.aborted) break;
                      if (chunk.text) fullText += chunk.text;
                      setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: fullText, searchSources: collectedSources } : msg));
                  }
              }
          }
      };

      try { await performRun(); } catch (err: any) {
          const errMsg = (err.message || "").toLowerCase();
          if (useNativeSearch && (errMsg.includes('403') || errMsg.includes('permission') || errMsg.includes('billing')) && !fullText) { 
               setIsSearchEnabled(false); 
               setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: "Search failed (Permission Denied).", isError: true } : msg));
          } else throw err;
      }
      const endTime = Date.now(); const latency = endTime - startTime;
      setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, isStreaming: false, latency } : msg));
      if (isNewChat && currentId && !isPrivateMode) { generateChatTitle(userText, fullText).then(async newTitle => { if (newTitle && newTitle.length > 0) { await storageService.updateSessionTitle(currentId!, newTitle); setSessionMeta(prev => prev ? {...prev, title: newTitle} : { title: newTitle, createdAt }); } }); }
    } catch (error: any) {
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) { setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, isStreaming: false, text: msg.text + " (已停止)" } : msg)); } 
      else { let errorText = "生成时发生错误。"; if (error.message) errorText = `错误：${error.message}`; setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: errorText, isError: true, isStreaming: false } : msg)); }
    } finally { setIsLoading(false); abortControllerRef.current = null; }
  };

  const handleDeleteMessage = async (msgId: string) => { if (!window.confirm("确定要删除这条消息及之后的所有对话吗？")) return; const index = messages.findIndex(m => m.id === msgId); if (index === -1) return; const updatedMessages = messages.slice(0, index); setMessages(updatedMessages); if (sessionId && !isPrivateMode) await storageService.saveSession({ id: sessionId, title: sessionMeta?.title || 'Chat', messages: updatedMessages, contextFiles, createdAt: sessionMeta?.createdAt || Date.now(), updatedAt: Date.now(), model: currentModel as ModelType }); };
  const handleRegenerate = async (msgIndex: number) => { if (isLoading) return; const userIndex = msgIndex - 1; if (userIndex < 0) return; const userMsg = messages[userIndex]; if (userMsg.inlineData && userMsg.inlineData.length > 0) setAttachments(userMsg.inlineData.map((d, i) => ({ base64: `data:${d.mimeType};base64,${d.data}`, mimeType: d.mimeType, previewUrl: `data:${d.mimeType};base64,${d.data}`, name: `restored_${i}`, file: new File([], `restored_${i}`) }))); const historyBefore = messages.slice(0, userIndex); setMessages(historyBefore); await handleSend(userMsg.text, historyBefore); };
  const saveEdit = async (msgId: string) => { const msgIndex = messages.findIndex(m => m.id === msgId); if (msgIndex === -1) return; const msg = messages[msgIndex]; if (msg.role === 'model') { const newMessages = [...messages]; newMessages[msgIndex] = { ...msg, text: editContent }; setMessages(newMessages); setEditingMessageId(null); } else { const historyBefore = messages.slice(0, msgIndex); setMessages(historyBefore); setEditingMessageId(null); await handleSend(editContent, historyBefore); } };
  const handlePrint = () => window.print();
  
  // Implement handleExportMarkdown to fix "Cannot find name 'handleExportMarkdown'" error
  const handleExportMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    
    let md = `# ${sessionMeta?.title || '对话导出'}\n\n`;
    messages.forEach(msg => {
      const role = msg.role === 'user' ? '用户' : 'AI 助手';
      md += `## ${role}\n\n${msg.text}\n\n`;
      if (msg.thinking) {
        md += `> **思考过程:**\n> ${msg.thinking.replace(/\n/g, '\n> ')}\n\n`;
      }
      if (msg.searchSources && msg.searchSources.length > 0) {
        md += `**参考来源:**\n`;
        msg.searchSources.forEach((s, i) => {
          md += `${i + 1}. [${s.title}](${s.uri})\n`;
        });
        md += `\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = (sessionMeta?.title || 'chat').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages, sessionMeta]);

  const formatMessageWithSources = (msg: Message) => { if (!msg.searchSources || msg.searchSources.length === 0) return msg.text; return msg.text.replace(/\[(\d+)\]/g, (match, id) => { const index = parseInt(id, 10) - 1; const source = msg.searchSources?.[index]; return source ? `[${match}](${source.uri})` : match; }); };
  const currentModelInfo = allModelOptions.find(m => m.id === currentModel) || allModelOptions[0];

  return (
    <div className="flex flex-row h-full max-w-7xl mx-auto w-full bg-white relative print:max-w-none print:block print:overflow-visible print:h-auto overflow-hidden" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="flex-1 flex flex-col h-full relative min-w-0">
          {isPrivateMode && <div className="bg-gray-800 text-white px-4 py-2 text-center text-xs flex items-center justify-center gap-2 print:hidden sticky top-[57px] z-10 animate-[fadeIn_0.3s]"><ShieldAlert className="w-3.5 h-3.5" /><span>私密模式：此对话记录不会被保存。</span></div>}
          {modelToast && <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/90 text-white px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 animate-[fadeIn_0.3s_ease-out] print:hidden"><Info className="w-4 h-4 text-blue-400" /><div className="flex flex-col"><span className="text-xs font-bold">{modelToast.name}</span><span className="text-[10px] text-gray-300">{modelToast.desc}</span></div></div>}
          {isDragging && <div className="absolute inset-4 z-50 bg-blue-50/90 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center animate-[fadeIn_0.2s] pointer-events-none print:hidden"><div className="p-4 bg-white rounded-full shadow-lg mb-4"><UploadCloud className="w-10 h-10 text-blue-500" /></div><p className="text-xl font-medium text-blue-600">释放文件以上传</p></div>}
          {previewImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-[fadeIn_0.2s] print:hidden" onClick={() => setPreviewImage(null)}><button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"><X className="w-8 h-8" /></button><img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} alt="Preview" /></div>}
          {isLiveActive && <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-900 to-black flex flex-col items-center justify-center text-white print:hidden"><div className="animate-pulse-slow mb-8"><div className="w-32 h-32 rounded-full bg-blue-500/30 flex items-center justify-center blur-xl"><div className="w-20 h-20 bg-blue-400/50 rounded-full"></div></div></div><h2 className="text-2xl font-light mb-8 tracking-wider">Live Conversation Active</h2><button onClick={handleLiveStop} className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-transform hover:scale-110"><X className="w-8 h-8" /></button></div>}

          <div className={`flex items-center justify-between px-3 md:px-4 py-2 border-b border-gray-100 backdrop-blur-md sticky top-0 z-20 print:hidden shrink-0 ${isPrivateMode ? 'bg-gray-900/95 text-white' : 'bg-white/80'}`}>
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
               <div className="relative shrink-0" ref={modelMenuRef}>
                 <button onClick={() => setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg transition-colors text-sm font-medium max-w-[160px] md:max-w-xs ${isPrivateMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}>
                   <span className={`${isPrivateMode ? 'text-blue-300' : 'text-[#1a73e8]'} truncate`}>{currentModelInfo.name}</span>
                   <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${isPrivateMode ? 'text-gray-400' : 'text-gray-500'} ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {isModelMenuOpen && (
                   <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-visible animate-[fadeIn_0.2s_ease-out] z-50 text-gray-800">
                     <div className="max-h-[60vh] md:max-h-[80vh] overflow-y-auto">
                       {allModelOptions.map((option) => {
                          const Icon = option.icon;
                          const config = PROVIDER_CONFIG[option.id];
                          const isExpanded = expandedModelId === option.id;
                          return (
                           <div key={option.id} className="flex flex-col border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <div className={`relative flex items-center ${currentModel === option.id ? 'bg-blue-50/60' : ''}`}>
                                  <button onClick={() => { setCurrentModel(option.id); setIsModelMenuOpen(false); }} className="flex-1 text-left px-4 py-3 flex items-start gap-3">
                                    <div className={`mt-0.5 p-1.5 rounded-full ${currentModel === option.id ? 'bg-blue-100 text-[#1a73e8]' : 'bg-gray-100 text-gray-500'}`}><Icon className="w-4 h-4" /></div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2"><div className={`text-sm font-medium ${currentModel === option.id ? 'text-[#1a73e8]' : 'text-gray-900'}`}>{option.name}</div>{option.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${option.badgeColor === 'green' ? 'bg-green-50 text-green-700 border-green-200' : (option.badgeColor === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200')}`}>{option.badge}</span>}</div><div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
                                    </div>
                                  </button>
                                  {config && (<button onClick={(e) => { e.stopPropagation(); setExpandedModelId(isExpanded ? null : option.id); }} className="p-3 text-gray-400 hover:text-blue-600 transition-colors h-full flex items-center justify-center border-l border-transparent hover:border-gray-200"><ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} /></button>)}
                              </div>
                              {isExpanded && config && (<div className="bg-gray-50 border-t border-gray-100 animate-[fadeIn_0.1s]">{(localStorage.getItem(config.presetsKey) ? JSON.parse(localStorage.getItem(config.presetsKey)!) : config.defaults).map((preset: any) => { const isActive = (currentModel === option.id && subModel === preset.value) || (currentModel !== option.id && localStorage.getItem(config.storageKey) === preset.value); return (<button key={preset.value} onClick={() => { localStorage.setItem(config.storageKey, preset.value); window.dispatchEvent(new Event('gemini-api-key-updated')); if (currentModel === option.id) { setSubModel(preset.value); } else { setCurrentModel(option.id); } setIsModelMenuOpen(false); }} className={`w-full text-left pl-14 pr-4 py-2.5 text-xs flex items-center justify-between hover:bg-gray-100 transition-colors ${isActive ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-gray-600'}`}><span className="truncate">{preset.name}</span>{isActive && <Check className="w-3 h-3" />}</button>); })}</div>)}
                           </div>
                          );
                       })}
                     </div>
                   </div>
                 )}
               </div>
               
               <button onClick={() => setIsSearchEnabled(!isSearchEnabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border shrink-0 ${isSearchEnabled ? 'bg-blue-50 text-blue-600 border-blue-100' : (isPrivateMode ? 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200')}`} title="联网搜索">
                  <Globe className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Search</span>
               </button>

               <button onClick={handleLiveStart} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${isPrivateMode ? 'bg-gray-800 text-blue-300 hover:bg-gray-700' : 'bg-blue-50 text-[#1a73e8] hover:bg-blue-100'}`}><Mic2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Live</span></button>
            </div>

            <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-1">
                <button onClick={() => setIsContextPanelOpen(!isContextPanelOpen)} className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${isContextPanelOpen || contextFiles.length > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-600 border-transparent'}`} title="知识库"><FolderOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline">知识库</span></button>
                <button onClick={handleExportMarkdown} className={`p-2 rounded-full transition-colors ${isPrivateMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`} title="导出 Markdown"><Download className="w-5 h-5" /></button>
                <button onClick={handlePrint} className={`hidden md:block p-2 rounded-full transition-colors ${isPrivateMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`} title="打印"><Printer className="w-5 h-5" /></button>
            </div>
          </div>

          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 md:space-y-8 custom-scrollbar relative print:overflow-visible print:h-auto print:block">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-[fadeIn_0.5s_ease-out_forwards] px-4 print:hidden">
                 <div className="flex flex-col items-center">
                    <div className={`p-0.5 rounded-full mb-4 ${isPrivateMode ? 'bg-gray-700' : 'bg-gradient-to-tr from-blue-500 to-purple-500'}`}><div className={`p-4 rounded-full shadow-sm ${isPrivateMode ? 'bg-gray-800' : 'bg-white'}`}>{isPrivateMode ? <Ghost className="w-10 h-10 text-gray-300" /> : <Sparkles className="w-10 h-10 text-transparent bg-clip-text bg-gradient-to-tr from-blue-500 to-purple-500 fill-current" />}</div></div>
                    <h1 className={`text-2xl md:text-3xl font-medium mb-2 ${isPrivateMode ? 'text-gray-400' : 'text-gray-800 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600'}`}>{isPrivateMode ? '私密模式' : '有什么可以帮你的吗？'}</h1>
                 </div>
                 {!isPrivateMode && (
                 <div className="w-full max-w-4xl">
                    <div className="flex items-center justify-between mb-4 pl-1 pr-1">
                       <div className="flex items-center gap-2"><Compass className="w-4 h-4 text-blue-500" /><p className="text-sm text-gray-500 font-medium uppercase tracking-wider">探索话题</p></div>
                       <button onClick={handleRefreshTopics} disabled={isTopicsLoading} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#1a73e8] transition-colors py-1.5 px-3 rounded-full hover:bg-blue-50 group border border-transparent hover:border-blue-100 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${isTopicsLoading ? 'animate-spin' : ''}`} /><span>换一换</span></button>
                    </div>
                    {isTopicsLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">{[1,2,3,4,5,6,7,8].map(i => (<div key={i} className="h-28 bg-white border border-gray-100 rounded-xl p-4"></div>))}</div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{displayedTopics.map((topic, idx) => { const Icon = getIconForTopic(topic.iconType) || topic.icon || TrendingUp; return (<button key={idx} onClick={() => handleSend(topic.text)} className="group relative flex flex-col h-full p-4 bg-white border border-gray-200 hover:border-blue-200 rounded-xl transition-all hover:shadow-md text-left"><div className="absolute top-4 right-4 text-gray-300 group-hover:text-blue-500 transition-colors"><Icon className="w-5 h-5" /></div><div className="mt-auto"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{topic.label}</span><p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{topic.desc}</p></div></button>); })}</div>)}
                 </div>
                 )}
              </div>
            ) : (
              <div className="w-full max-w-3xl mx-auto space-y-6 pb-4">
                 {messages.map((msg, idx) => <MessageBubble key={msg.id} idx={idx} msg={msg} editingMessageId={editingMessageId} setEditingMessageId={setEditingMessageId} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit} handleRegenerate={handleRegenerate} handleDeleteMessage={handleDeleteMessage} formatMessageWithSources={formatMessageWithSources} setPreviewImage={setPreviewImage} handleTTS={handleTTS} ttsLoadingId={ttsLoadingId} playingMessageId={playingMessageId} modelOptions={allModelOptions} />)}
                 <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
          {showScrollBottomBtn && <button onClick={scrollToBottom} className="absolute bottom-24 right-6 md:right-10 p-2 bg-white border border-gray-200 shadow-lg rounded-full text-gray-500 hover:text-blue-600 transition-all z-30"><ArrowDown className="w-5 h-5" /></button>}

          <div className="p-2 md:p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 relative print:hidden">
            <div className="max-w-3xl mx-auto relative">
              <div id="context-panel-dropzone" className={`transition-all duration-300 overflow-hidden ${isContextPanelOpen || contextFiles.length > 0 ? 'max-h-60 mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-gray-50 rounded-xl border border-blue-100 p-3">
                      <div className="flex justify-between items-center mb-2 px-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider"><FolderOpen className="w-3.5 h-3.5" /><span>知识库 ({contextFiles.length})</span></div>
                          <button onClick={() => setContextFiles([])} className="text-[10px] text-red-500 hover:bg-red-50 px-2 py-1 rounded">清空</button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          <button onClick={handleConnectLocalFile} className="flex flex-col items-center justify-center w-20 h-20 bg-white border border-dashed border-blue-300 rounded-lg shrink-0 hover:bg-blue-50 transition-colors gap-1 group"><Plus className="w-4 h-4 text-blue-500" /><span className="text-[9px] text-gray-500">添加</span></button>
                          {contextFiles.map((file) => { const Icon = getFileIcon(file.type, file.name); return (<div key={file.id} className="relative w-20 h-20 bg-white rounded-lg border border-gray-200 shrink-0 group hover:border-blue-300 transition-all shadow-sm"><div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><button onClick={() => removeContextFile(file.id)} className="p-0.5 bg-white rounded-full text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button></div><div className="h-full flex flex-col items-center justify-center p-2 cursor-pointer" onClick={() => openContextFile(file)}><Icon className="w-6 h-6 text-gray-400 mb-1" /><div className="text-[9px] text-center w-full truncate px-1 text-gray-600">{file.name}</div></div></div>); })}
                      </div>
                  </div>
              </div>

              <div className={`relative flex items-end gap-2 bg-white rounded-2xl border transition-all duration-200 shadow-sm ${isDragging ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-200 hover:border-gray-300 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50'}`}>
                <button className="p-2 md:p-3 text-gray-400 hover:text-[#1a73e8] transition-colors rounded-xl" onClick={() => fileInputRef.current?.click()} title="附件"><Paperclip className="w-5 h-5" /></button>
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files && e.target.files.length > 0) { processFiles(Array.from(e.target.files), false); } if (fileInputRef.current) fileInputRef.current.value = ''; }} />
                <textarea 
                    ref={textareaRef} 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                    onPaste={handlePaste}
                    placeholder="输入消息..." 
                    className="w-full py-3 md:py-3.5 max-h-[200px] bg-transparent border-none outline-none resize-none text-gray-800 text-sm md:text-base" 
                    rows={1} 
                />
                <button onClick={() => isLoading ? abortControllerRef.current?.abort() : handleSend()} disabled={(!input.trim() && attachments.length === 0) && !isLoading} className={`p-2 md:p-2.5 m-1 md:m-1.5 rounded-xl flex items-center justify-center transition-all duration-200 ${isLoading ? 'bg-red-50 text-red-500' : (input.trim() || attachments.length > 0 ? 'bg-[#1a73e8] text-white' : 'bg-gray-100 text-gray-300')}`}>{isLoading ? <StopCircle className="w-5 h-5 fill-current" /> : <Send className="w-5 h-5" />}</button>
              </div>
              
              {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 px-1 animate-[fadeIn_0.2s]">
                      {attachments.map((att, i) => (
                          <div key={i} className="relative group bg-white border border-gray-200 rounded-lg p-2 pr-8 shadow-sm flex items-center gap-2 max-w-[200px]">
                              {att.previewUrl ? <img src={att.previewUrl} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center text-gray-400"><FileIconGeneric className="w-4 h-4" /></div>}
                              <span className="text-xs text-gray-700 truncate font-medium">{att.name}</span>
                              <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
