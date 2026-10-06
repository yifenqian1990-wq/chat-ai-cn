
import { GoogleGenAI, Chat, GenerateContentResponse, Content, Modality, LiveServerMessage, Part, FunctionDeclaration, Type } from "@google/genai";
import { ModelType, SearchSource, ContextFile, SearchProvider, SearchResult, CustomProvider } from '../types';
import { performWebSearch, getSearchConfig } from './searchService';
import { generateEdgeAudio } from './edgeTtsService';

export const DEFAULT_API_KEY = "";

let genAI: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let currentBaseUrl: string | null = null;

export const getApiKey = (): string => {
  return localStorage.getItem('gemini_api_key') || DEFAULT_API_KEY;
};

// Helper to get global proxy settings
const getProxyConfig = () => {
    return {
        url: localStorage.getItem('global_proxy_url') || '',
        enabled: localStorage.getItem('global_proxy_enabled') === 'true'
    };
};

export const getBaseUrl = (): string => {
   // 1. Check for Global Proxy
   const { url: proxyUrl, enabled: proxyEnabled } = getProxyConfig();
   if (proxyEnabled && proxyUrl) {
       // Automatic splicing: Ensure protocol exists
       let url = proxyUrl.trim();
       if (!url.startsWith('http://') && !url.startsWith('https://')) {
           url = `https://${url}`;
       }
       if (url.endsWith('/')) {
           url = url.slice(0, -1);
       }
       return url;
   }

   // 2. Fallback to specific Gemini Base URL
   let url = localStorage.getItem('gemini_base_url') || "";
   url = url.trim();
   if (url) {
       if (!url.startsWith('http://') && !url.startsWith('https://')) {
           url = `https://${url}`;
       }
       if (url.endsWith('/')) {
           url = url.slice(0, -1);
       }
   }
   return url;
};

export const resetAI = () => {
  genAI = null;
  currentApiKey = null;
  currentBaseUrl = null;
};

export const getAI = (apiVersion: string = 'v1beta'): GoogleGenAI => {
  const key = getApiKey();
  const baseUrl = getBaseUrl();
  
  // Note: We don't cache strictly by version here for the singleton, 
  // but usually standard chat uses v1beta. 
  // If specific version is needed, it's better to instantiate directly (like in connectLiveSession).
  if (!genAI || key !== currentApiKey || baseUrl !== currentBaseUrl) {
    const options: any = { apiKey: key, apiVersion };
    if (baseUrl) {
        options.baseUrl = baseUrl;
    }
    genAI = new GoogleGenAI(options);
    currentApiKey = key;
    currentBaseUrl = baseUrl;
  }
  return genAI;
};

export const testApiKeyConnection = async (apiKey: string): Promise<boolean> => {
    try {
        const baseUrl = getBaseUrl();
        const options: any = { apiKey };
        if (baseUrl) options.baseUrl = baseUrl;
        
        const ai = new GoogleGenAI(options);
        await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: 'test',
        });
        return true;
    } catch (e) {
        throw e;
    }
};

const TOOL_SYSTEM_PROMPT = `
You are a helpful and intelligent assistant.
You have access to a web search tool called "Tavily" to get real-time information, news, weather, or facts you don't know.

INSTRUCTIONS:
1. If the user asks a question that requires external information (e.g., "What is the weather in Tokyo?", "Latest news about AI", "Who won the game yesterday?"), you MUST output a JSON object to call the tool.
2. The JSON format must be EXACTLY: {"tool": "tavily", "query": "your search query"}
3. Do NOT output markdown code blocks (like \`\`\`json). Just output the raw JSON string on a single line.
4. If the user is just chatting (e.g., "Hello", "Write a poem", "Help me code"), reply with normal text. Do NOT call the tool.
`;

export const createChat = (
    model: ModelType, 
    history?: Content[], 
    config?: { 
        imageAspectRatio?: string; 
        imageSize?: string; 
        useGoogleSearch?: boolean;
        enableAutoSearchTool?: boolean;
    },
    contextFiles?: ContextFile[]
): Chat => {
    const ai = getAI();
    let modelName = model as string;
    
    // Internal mapping for special models
    if (model === ModelType.PRO_THINKING) modelName = 'gemini-3-pro-preview';

    // For Gemini Models
    if (modelName.startsWith('gemini') || modelName.startsWith('veo')) {
         const tools: any[] = [];
         // Native Google Search (Preferred if available/requested)
         if (config?.useGoogleSearch) {
             tools.push({ googleSearch: {} });
         }

         const generationConfig: any = {};
         let systemInstruction = undefined;

         // Thinking Config
         if (model === ModelType.PRO_THINKING) {
             generationConfig.thinkingConfig = { thinkingBudget: 1024 }; 
         }

         // Inject Manual Tool Prompt if Native Search is OFF but Auto Tool is ON
         if (!config?.useGoogleSearch && config?.enableAutoSearchTool) {
             systemInstruction = TOOL_SYSTEM_PROMPT;
         }

         return ai.chats.create({
            model: modelName,
            history: history,
            config: {
                tools: tools.length > 0 ? tools : undefined,
                systemInstruction: systemInstruction,
                ...generationConfig
            }
        });
    }

    // For external providers (Ollama, Groq, etc.), return a placeholder object 
    // that holds history so sendMessageStream can use it.
    // We use 'any' casting to satisfy the return type 'Chat'.
    return {
        _history: history || [],
        sendMessageStream: async () => { throw new Error("Not implemented in mock"); }
    } as any;
};

export const generateChatTitle = async (userMessage: string, botResponse: string): Promise<string> => {
    // Prioritize SiliconFlow Qwen for better Chinese title generation if key exists
    const sfKey = localStorage.getItem('siliconflow_api_key');
    if (sfKey) {
        try {
            // Check global proxy settings for SF calls too
            const { url: proxyUrl, enabled: proxyEnabled } = getProxyConfig();
            let endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
            
            if (proxyEnabled && proxyUrl) {
                try {
                    const originalObj = new URL(endpoint);
                    const proxyObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`);
                    originalObj.protocol = proxyObj.protocol;
                    originalObj.host = proxyObj.host;
                    originalObj.port = proxyObj.port;
                    endpoint = originalObj.toString();
                } catch(e) {}
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sfKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'Qwen/Qwen2.5-72B-Instruct',
                    messages: [
                        { role: 'system', content: "你是一个智能总结助手。请根据用户的输入和AI的回答，生成一个简短、精准、抓住重点的对话标题。要求：\n1. 语言简练，不超过15个字。\n2. 凸出核心话题。\n3. 不要使用引号、书名号或结尾标点。\n4. 直接输出标题文本。" },
                        { role: 'user', content: `User: ${userMessage.substring(0, 500)}\nBot: ${botResponse.substring(0, 500)}` }
                    ],
                    stream: false,
                    max_tokens: 60,
                    temperature: 0.7
                })
            });

            if (response.ok) {
                const data = await response.json();
                let title = data.choices?.[0]?.message?.content?.trim();
                if (title) {
                    // Cleanup any accidental quotes or trailing periods
                    return title.replace(/^["'《]|["'》]$/g, '').replace(/[。\.]$/, '');
                }
            }
        } catch (e) {
            console.warn("[ChatTitle] SF failed, fallback to Gemini", e);
        }
    }

    // Fallback to Gemini
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: `Generate a short, concise title (max 6 words) for this chat based on the first interaction. 
            User: ${userMessage}
            Bot: ${botResponse}
            Title:`,
        });
        return response.text?.trim() || "New Chat";
    } catch (e) {
        return "New Chat";
    }
};

export const checkSearchIntent = async (query: string): Promise<boolean> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: `Analyze if this query requires real-time web search info. Answer ONLY 'YES' or 'NO'.
            Query: "${query}"`,
        });
        const text = response.text?.trim().toUpperCase();
        return text?.includes('YES') || false;
    } catch (e) {
        return true;
    }
};

// NEW: Search Result Analysis & Refinement using Qwen or Gemini
export const processSearchResultsWithAI = async (query: string, results: SearchResult[]): Promise<string> => {
    const rawContext = results.map((r, i) => `[${i+1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n');
    
    const systemPrompt = `You are a Search Result Analyst. Your goal is to process raw search results for the user's query: "${query}".

    Raw Results:
    ${rawContext}

    Instructions:
    1. Analyze the User's Intent behind "${query}":
       - Is it a specific fact lookup? (Extract the fact)
       - Is it a broad topic request? (Summarize key points)
       - Is it a request for resources/links? (List relevant references)
       - Is it a complex question? (Synthesize information)
    2. Filter out clearly irrelevant or low-quality results from the Raw Results.
    3. Output a structured "Refined Context" block.
    4. CRITICAL: You MUST retain the citation indices [x] from the raw results when referencing information. Do not re-number them.
    5. If the raw results are insufficient, state that briefly in the context.

    Output Format:
    Return ONLY the refined context text (in Markdown). Do not include conversational filler like "Here is the analysis".`;

    // 1. Try SiliconFlow (Qwen-7B) as requested
    const sfKey = localStorage.getItem('siliconflow_api_key');
    if (sfKey) {
        try {
            // Apply proxy if enabled
            const { url: proxyUrl, enabled: proxyEnabled } = getProxyConfig();
            let endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
            if (proxyEnabled && proxyUrl) {
                try {
                   const originalObj = new URL(endpoint);
                   const proxyObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`);
                   originalObj.protocol = proxyObj.protocol;
                   originalObj.host = proxyObj.host;
                   originalObj.port = proxyObj.port;
                   endpoint = originalObj.toString();
                } catch(e) {}
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sfKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'Qwen/Qwen2.5-7B-Instruct', // Using 7B as requested
                    messages: [
                        { role: 'system', content: systemPrompt }
                    ],
                    stream: false,
                    max_tokens: 1500,
                    temperature: 0.5 
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content?.trim() || rawContext;
            }
        } catch (e) {
            console.warn("[SearchAnalysis] SF Qwen-7B failed, falling back to Gemini.", e);
        }
    }

    // 2. Fallback to Gemini Flash Lite (Fast & Cheap)
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: systemPrompt,
        });
        return response.text?.trim() || rawContext;
    } catch (e) {
        console.error("[SearchAnalysis] Gemini failed, using raw context.", e);
        return `Context from Web Search (Raw):\n${rawContext}`;
    }
};

// Define the interface for stream chunks to fix disjoint union type errors
export interface StreamChunk {
    text?: string;
    thinking?: string;
    groundingMetadata?: SearchSource[];
    generatedImage?: string;
    generatedVideo?: string;
    generatedAudio?: string;
}

const sendOllamaStream = async function* (model: string, messages: any[], onMetadata: any) {
    // Ollama URL is typically local/user-defined, usually we don't apply Global Proxy unless specified
    // But since it's local, we respect the user setting.
    const host = localStorage.getItem('ollama_host') || 'http://localhost:11434';
    const ollamaMessages = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role, // FIX: Map 'model' to 'assistant'
        content: m.parts[0].text
    }));
    
    try {
        const response = await fetch(`${host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: ollamaMessages, stream: true })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama Error (${response.status}): ${errText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");
        
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        yield { text: json.message.content };
                    }
                    if (json.done) return;
                } catch (e) {}
            }
        }
    } catch (e: any) {
        yield { text: `Ollama Connection Failed: ${e.message}` };
    }
};

const sendOpenAIStyleStream = async function* (originalUrl: string, apiKey: string, model: string, messages: any[], customHeaders?: Record<string, string>) {
    const openAIMessages = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role, // FIX: Map 'model' to 'assistant'
        content: m.parts[0].text
    }));

    let fetchUrl = originalUrl.trim();
    
    // Auto-normalize: Ensure endpoint is complete for OpenAI standard
    if (!fetchUrl.endsWith('/chat/completions')) {
        fetchUrl = fetchUrl.endsWith('/') ? fetchUrl + 'chat/completions' : fetchUrl + '/chat/completions';
    }
    
    // Apply Global Proxy logic if enabled
    const { url: proxyUrl, enabled: proxyEnabled } = getProxyConfig();
    if (proxyEnabled && proxyUrl) {
         try {
             // We replace the Origin (Protocol + Host + Port) of the target URL with the Proxy URL
             const originalObj = new URL(fetchUrl);
             const proxyObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`);
             
             originalObj.protocol = proxyObj.protocol;
             originalObj.host = proxyObj.host;
             originalObj.port = proxyObj.port;
             
             fetchUrl = originalObj.toString();
         } catch (e) {
             console.warn("Invalid Proxy/Target URL, using normalized original.", e);
         }
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...customHeaders
        };

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: openAIMessages,
                stream: true
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = errText;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.error?.message || errText;
            } catch(e) {}
            throw new Error(`API Request Failed (${response.status}): ${errMsg}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line === 'data: [DONE]') return;
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        const content = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content;
                        const reasoning = json.choices?.[0]?.delta?.reasoning_content; // DeepSeek R1 style

                        if (reasoning) {
                            yield { thinking: reasoning };
                        }
                        if (content) {
                            yield { text: content };
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e: any) {
        yield { text: `API Provider Error: ${e.message}` };
    }
};

export const sendMessageStream = async function* (
    chat: Chat, 
    message: string, 
    attachments: { base64: string; mimeType: string }[] = [],
    modelOverride?: ModelType,
    config?: { 
        imageAspectRatio?: string; 
        imageSize?: string; 
        videoAspectRatio?: string;
        useGoogleSearch?: boolean;
        enableAutoSearchTool?: boolean;
        searchResultsCount?: number;
        specificModelName?: string;
        customProvider?: CustomProvider; // NEW: Support for custom providers
    }
): AsyncGenerator<StreamChunk, void, unknown> {
    if (modelOverride) {
        // Extract history from the mock chat object
        const currentHistory: Content[] = (chat as any)._history || [];
        
        // Inject Search Tool Prompt if configured
        if (config?.enableAutoSearchTool) {
            const systemMsgCheck = currentHistory.find(m => m.role === 'system');
            if (!systemMsgCheck) {
                // Prepend system instruction
                currentHistory.unshift({ role: 'system' as any, parts: [{ text: TOOL_SYSTEM_PROMPT }] });
            }
        }

        const messages = [...currentHistory, { role: 'user', parts: [{ text: message }] }];

        if (modelOverride === ModelType.CUSTOM_API && config?.customProvider) {
            const cp = config.customProvider;
            yield* sendOpenAIStyleStream(cp.baseUrl, cp.apiKey, cp.defaultModel, messages);
            return;
        }

        if (modelOverride === ModelType.OLLAMA) {
             const subModel = config?.specificModelName || localStorage.getItem('ollama_model') || 'qwen2.5:3b';
             yield* sendOllamaStream(subModel, messages, null);
             return;
        }
        if (modelOverride === ModelType.GROQ) {
            const key = localStorage.getItem('groq_api_key');
            const subModel = config?.specificModelName || localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile';
            yield* sendOpenAIStyleStream('https://api.groq.com/openai/v1/chat/completions', key || '', subModel, messages);
            return;
        }
        if (modelOverride === ModelType.ALIYUN) {
            const key = localStorage.getItem('aliyun_api_key');
            const subModel = config?.specificModelName || localStorage.getItem('aliyun_model') || 'qwen-plus';
            yield* sendOpenAIStyleStream('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', key || '', subModel, messages);
            return;
        }
        if (modelOverride === ModelType.SILICONFLOW) {
            const key = localStorage.getItem('siliconflow_api_key');
            const subModel = config?.specificModelName || localStorage.getItem('siliconflow_model') || 'deepseek-ai/DeepSeek-R1';
            yield* sendOpenAIStyleStream('https://api.siliconflow.cn/v1/chat/completions', key || '', subModel, messages);
            return;
        }
        if (modelOverride === ModelType.OPENROUTER) {
            const key = localStorage.getItem('openrouter_api_key');
            const subModel = config?.specificModelName || localStorage.getItem('openrouter_model') || 'google/gemini-2.0-flash-001';
            // OpenRouter recommends these headers for rankings and statistics
            const headers = {
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Gemini Clone'
            };
            yield* sendOpenAIStyleStream('https://openrouter.ai/api/v1/chat/completions', key || '', subModel, messages, headers);
            return;
        }
        // Fallback or Image/TTS models that don't use this stream path often
    }

    if (!chat) throw new Error("Chat session not initialized");

    const parts: Part[] = [];
    if (attachments.length > 0) {
        attachments.forEach(a => {
            parts.push({
                inlineData: {
                    mimeType: a.mimeType,
                    data: a.base64.includes(',') ? a.base64.split(',')[1] : a.base64
                }
            });
        });
    }
    parts.push({ text: message });

    try {
        // FIX: The SDK expects the 'message' property to be the content (string or Part[])
        // NOT { parts: [...] } which causes 'ContentUnion is required' error.
        const result = await chat.sendMessageStream({ message: parts });
        for await (const chunk of result) {
            const text = chunk.text;
            const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            
            if (text) yield { text };
            
            if (grounding) {
                 const sources: SearchSource[] = grounding.map((g: any) => ({
                     uri: g.web?.uri || '',
                     title: g.web?.title || ''
                 })).filter((s: SearchSource) => s.uri);
                 yield { groundingMetadata: sources };
            }

            const responseParts = chunk.candidates?.[0]?.content?.parts;
            if (responseParts) {
                for (const part of responseParts) {
                    if (part.inlineData) {
                        const mimeType = part.inlineData.mimeType;
                        const data = part.inlineData.data;
                        if (mimeType.startsWith('audio/')) {
                            yield { generatedAudio: data };
                        } else {
                            const base64 = `data:${mimeType};base64,${data}`;
                            yield { generatedImage: base64 };
                        }
                    }
                    if (part.videoMetadata) {
                        // Handle video if needed
                    }
                }
            }
        }
    } catch (e: any) {
        yield { text: `Gemini Error: ${e.message}` };
    }
};

export const connectLiveSession = async (
    onAudioData: (base64: string) => void,
    onClose: () => void,
    onError: (err: any) => void
) => {
    const apiKey = getApiKey();
    const baseUrl = getBaseUrl();
    
    // Explicitly create a client for Live with v1alpha if needed
    // The Live API is typically on v1alpha/v1beta depending on rollout, but v1alpha is often required for WebSocket paths in proxies.
    // We strictly follow the SDK usage here but allow baseUrl injection.
    const liveAI = new GoogleGenAI({ 
        apiKey, 
        baseUrl: baseUrl || undefined,
        apiVersion: 'v1alpha' // Force v1alpha for Live API compatibility
    });

    try {
        // @ts-ignore
        const session = await liveAI.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            callbacks: {
                onopen: () => console.log("Live Session Opened"),
                onmessage: (msg: LiveServerMessage) => {
                    // Handle audio output
                    const parts = msg.serverContent?.modelTurn?.parts;
                    if (parts) {
                        for (const part of parts) {
                            if (part.inlineData?.data) {
                                onAudioData(part.inlineData.data);
                            }
                        }
                    }
                    // Handle interruption
                    if (msg.serverContent?.interrupted) {
                        onAudioData("__INTERRUPTED__");
                    }
                },
                onclose: (e: any) => {
                    console.log("Live Session Closed");
                    onClose();
                },
                onerror: (e: any) => {
                    console.error("Live Session Error", e);
                    onError(e);
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                }
            }
        });
        return session;
    } catch (e) {
        onError(e);
        return null;
    }
};

export const generateTrendingTopics = async (): Promise<any[]> => {
    // 1. Try to get Web Search Context for real-time trends
    let searchContext = "";
    try {
        // Use a broad query to catch various trending topics
        // We use index 0 (first page)
        const results = await performWebSearch("今日热门话题 科技 娱乐 民生 国际新闻 排行榜", 0);
        if (results && results.length > 0) {
            searchContext = results.slice(0, 6).map(r => `- ${r.title}`).join("\n");
        }
    } catch (e) {
        console.log("[Trending] Search unavailable, using internal knowledge.");
    }

    const systemPrompt = `Generate 8 diverse trending topics for an AI chat assistant.
    
    ${searchContext ? `Real-time News Context (Latest Trends):\n${searchContext}\n` : ''}
    
    Requirements:
    1. Topics must be DIVERSE (Technology, Entertainment, Society, Lifestyle, Culture, Career, etc.).
    2. Do NOT limit to AI/Tech. Include fun, viral, or daily life topics.
    3. If search context is provided, use it to pick 2-3 hot topics, but keep the rest diverse.
    4. Provide exactly 8 topics.
    
    Format as a valid JSON array of objects:
    [
      { 
        "text": "Full prompt for the user to send (e.g. 'Help me plan a trip to...')", 
        "label": "Title (Max 6 chars)", 
        "desc": "Subtitle (Max 15 chars)", 
        "iconType": "One of: trend, code, image, brain, globe, music, movie, game, camera, plane, coffee"
      }
    ]
    
    Language: Chinese (Simplified).
    Return ONLY valid JSON. No markdown block markers.`;

    const sfKey = localStorage.getItem('siliconflow_api_key');
    if (sfKey) {
        try {
            // Check Proxy for Trending (SF)
            const { url: proxyUrl, enabled: proxyEnabled } = getProxyConfig();
            let endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
            if (proxyEnabled && proxyUrl) {
                try {
                    const originalObj = new URL(endpoint);
                    const proxyObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`);
                    originalObj.protocol = proxyObj.protocol;
                    originalObj.host = proxyObj.host;
                    originalObj.port = proxyObj.port;
                    endpoint = originalObj.toString();
                } catch(e) {}
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sfKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'Qwen/Qwen2.5-72B-Instruct', 
                    messages: [
                        { role: 'system', content: systemPrompt }
                    ],
                    stream: false,
                    max_tokens: 2048,
                    temperature: 0.8
                })
            });

            if (response.ok) {
                const data = await response.json();
                let text = data.choices?.[0]?.message?.content || "";
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const jsonMatch = text.match(/\[.*\]/s);
                if (jsonMatch) return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn("[Trending] SF failed, fallback to Gemini");
        }
    }

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: systemPrompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text || "";
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to generate topics", e);
    }
    return [];
};

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
