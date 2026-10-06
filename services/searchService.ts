
import { SearchProvider, SearchResult } from '../types';

export const getSearchConfig = () => {
  return {
    provider: (localStorage.getItem('search_provider') as SearchProvider) || SearchProvider.GOOGLE,
    googleKey: localStorage.getItem('search_google_key') || '',
    googleCx: localStorage.getItem('search_google_cx') || '',
    tavilyKey: localStorage.getItem('search_tavily_key') || '',
    braveKey: localStorage.getItem('search_brave_key') || ''
  };
};

export const performWebSearch = async (query: string, startIndex: number = 0, limit: number = 10): Promise<SearchResult[]> => {
  const config = getSearchConfig();
  console.log(`[SearchService] Performing search with provider: ${config.provider}, query: "${query}"`);
  
  try {
    switch (config.provider) {
      case SearchProvider.TAVILY:
        return await searchTavily(query, config.tavilyKey, limit);
      case SearchProvider.BRAVE:
        console.log("[SearchService] Routing to searchBrave");
        return await searchBrave(query, config.braveKey, startIndex, limit);
      case SearchProvider.DUCKDUCKGO:
        return await searchDuckDuckGo(query, startIndex, limit);
      case SearchProvider.GOOGLE:
      default:
        return await searchGoogle(query, config.googleKey, config.googleCx, startIndex, limit);
    }
  } catch (error) {
    console.error("[SearchService] Search Error:", error);
    throw error;
  }
};

const safeJsonFetch = async (url: string, options?: RequestInit): Promise<any> => {
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => "No error body");
        let parsedMessage = errorText;
        try {
            const errObj = JSON.parse(errorText);
            if (errObj.error?.message) parsedMessage = errObj.error.message;
            else if (typeof errObj.error === 'string') parsedMessage = errObj.error;
            else if (errObj.message) parsedMessage = errObj.message;
        } catch {}
        throw new Error(`Request Failed (${response.status}): ${parsedMessage.slice(0, 150)}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Expected JSON but got:", text.slice(0, 200));
        throw new Error(`Invalid response format: Expected JSON but received HTML/Text. (Starts with: ${text.slice(0, 50)}...)`);
    }

    return await response.json();
};

const searchGoogle = async (query: string, apiKey: string, cx: string, startIndex: number, limit: number): Promise<SearchResult[]> => {
  if (!apiKey || !cx) throw new Error("Google Search API Key or Context ID (CX) not configured.");

  // Keep track of keys we've already tried to prevent cycles in one request
  const triedKeys = new Set<string>();
  triedKeys.add(apiKey);

  const attemptFetch = async (currentKey: string): Promise<any> => {
      const startParam = startIndex + 1;
      const effectiveLimit = Math.min(limit, 10); 
      const url = `https://www.googleapis.com/customsearch/v1?key=${currentKey}&cx=${cx}&q=${encodeURIComponent(query)}&start=${startParam}&num=${effectiveLimit}`;
      
      try {
          return await safeJsonFetch(url);
      } catch (err: any) {
          // Check for Quota Limit (429) or Forbidden (403) specifically for usage limits
          if (err.message.includes("429") || err.message.includes("403")) {
              throw new Error("QUOTA_EXCEEDED");
          }
          throw err;
      }
  };

  try {
      const data = await attemptFetch(apiKey);
      return processGoogleResults(data);
  } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") {
          console.warn("[GoogleSearch] Quota exceeded on primary key. Attempting failover...");
          
          // Load presets
          let presets: {key: string, label: string}[] = [];
          try {
              presets = JSON.parse(localStorage.getItem('search_google_key_presets') || '[]');
          } catch(e) {}

          // Find the first key that hasn't been tried
          // Note: This logic assumes all presets share the same CX (Search Engine ID).
          // If keys belong to different projects with different engines, CX would also need rotation, 
          // but usually users create multiple keys for the same project/engine to pool quotas.
          const nextPreset = presets.find(p => !triedKeys.has(p.key) && p.key !== apiKey);

          if (nextPreset) {
              console.log(`[GoogleSearch] Switching to backup key: ${nextPreset.label}`);
              // Persist the new working key so subsequent requests use it immediately
              localStorage.setItem('search_google_key', nextPreset.key);
              
              // Retry with new key
              const data = await attemptFetch(nextPreset.key);
              return processGoogleResults(data);
          } else {
              throw new Error("Google Search Quota Exceeded (No available backup keys).");
          }
      }
      throw err;
  }
};

const processGoogleResults = (data: any): SearchResult[] => {
    return (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        content: item.snippet,
        source: 'Google',
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.link).hostname}&sz=32`
    }));
};

const searchTavily = async (query: string, apiKey: string, limit: number): Promise<SearchResult[]> => {
  if (!apiKey) throw new Error("Tavily API Key not configured.");

  const data = await safeJsonFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: "basic",
      include_images: false,
      max_results: limit
    })
  });

  return (data.results || []).map((item: any) => ({
    title: item.title,
    url: item.url,
    content: item.content,
    source: 'Tavily',
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`
  }));
};

const searchBrave = async (query: string, apiKey: string, offset: number, limit: number): Promise<SearchResult[]> => {
  if (!apiKey) throw new Error("Brave Search API Key not configured.");

  const page = Math.floor(offset / 10); 
  // Brave count max is usually 20
  const effectiveLimit = Math.min(limit, 20);
  
  // Use our local server proxy to bypass CORS and handle headers correctly
  // Using relative path to ensure it hits the same origin
  const url = `/api/search/brave?q=${encodeURIComponent(query)}&count=${effectiveLimit}&offset=${page}`;
  console.log(`[SearchService] Fetching from Brave Proxy: ${url}`);
  console.log(`[SearchService] Current origin: ${window.location.origin}`);
  
  try {
    const data = await safeJsonFetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    });
    console.log("[SearchService] Brave search successful");
    
    return (data.web?.results || []).map((item: any) => {
      let hostname = '';
      try {
        hostname = new URL(item.url || '').hostname;
      } catch {
        hostname = '';
      }
      return {
        title: item.title || '',
        url: item.url || '',
        content: item.description || '',
        source: 'Brave',
        favicon: hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : ''
      };
    });
  } catch (error: any) {
    console.error("[SearchService] Brave Search Error:", error);
    throw error;
  }
};

const searchDuckDuckGo = async (query: string, startIndex: number, limit: number): Promise<SearchResult[]> => {
    const PROXY_URL = 'https://api.allorigins.win/raw?url=';
    const DDG_URL = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${startIndex}`;
    
    try {
        const response = await fetch(`${PROXY_URL}${encodeURIComponent(DDG_URL)}`);
        
        if (!response.ok) throw new Error(`DuckDuckGo request failed: ${response.status}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        const results: SearchResult[] = [];
        
        const rows = doc.querySelectorAll('.result');
        
        rows.forEach((row) => {
            const linkEl = row.querySelector('.result__a') as HTMLAnchorElement;
            const snippetEl = row.querySelector('.result__snippet');
            
            if (linkEl && snippetEl) {
                let url = linkEl.getAttribute('href') || '';
                
                if (url.startsWith('//duckduckgo.com/l/')) {
                    url = 'https:' + url;
                }
                
                if (url.includes('uddg=')) {
                    try {
                        const match = url.match(/uddg=([^&]+)/);
                        if (match && match[1]) {
                            url = decodeURIComponent(match[1]);
                        }
                    } catch(e) { /* keep original if fail */ }
                }
                
                results.push({
                    title: linkEl.textContent?.trim() || 'No Title',
                    url: url,
                    content: snippetEl.textContent?.trim() || '',
                    source: 'DuckDuckGo',
                    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`
                });
            }
        });
        
        return results.slice(0, limit);
        
    } catch (error: any) {
        console.error("DDG Scraping Error", error);
        throw new Error("DuckDuckGo 访问失败 (CORS)。请尝试其他搜索引擎，或使用 CORS 插件。");
    }
};
