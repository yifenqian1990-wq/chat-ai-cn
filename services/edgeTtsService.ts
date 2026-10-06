
const EDGE_TTS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

const VOICE_LIST = {
  "zh-CN-XiaoxiaoNeural": "zh-CN-XiaoxiaoNeural", // Female, Warm
  "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",       // Male, Calm
  "en-US-JennyNeural": "en-US-JennyNeural",       // English Female
  "en-US-GuyNeural": "en-US-GuyNeural",           // English Male
};

// Helper to generate standard UUID v4
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Escape XML special characters to prevent SSML injection errors
function escapeXML(str: string): string {
  return str.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Helper to construct the correct WebSocket URL based on user input
function getWebsocketUrl(connectionId: string): string {
    let customUrl = localStorage.getItem('edge_tts_url');
    
    // 1. Use Default if empty
    if (!customUrl || !customUrl.trim()) {
        return `${EDGE_TTS_URL}&ConnectionId=${connectionId}`;
    }

    customUrl = customUrl.trim();

    // 2. Protocol handling: If user entered just an IP (e.g. 192.168.1.5:7890), default to ws://
    //    If it's a domain but no protocol, default to wss://
    if (!customUrl.startsWith('ws://') && !customUrl.startsWith('wss://')) {
        const isLocalIp = /^(localhost|127\.|192\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/.test(customUrl);
        customUrl = `${isLocalIp ? 'ws' : 'wss'}://${customUrl}`;
    }

    // 3. Path Handling:
    //    If the user inputs a ROOT URL (e.g., ws://192.168.10.105:7890), we assume they are using a transparent TCP forwarder
    //    and we need to append the official Bing API path and Token.
    //    We check this by looking for specific keywords in the path.
    const hasPath = customUrl.includes('/consumer/speech/synthesize') || customUrl.includes('/v1');
    
    if (!hasPath) {
        // Remove trailing slash if present to avoid double slash
        customUrl = customUrl.replace(/\/$/, '');
        // Append standard path part
        const standardPath = "/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
        return `${customUrl}${standardPath}&ConnectionId=${connectionId}`;
    }

    // 4. If user input a full custom URL (e.g. a specific edge-tts-proxy project endpoint), just append ID
    const separator = customUrl.includes('?') ? '&' : '?';
    return `${customUrl}${separator}ConnectionId=${connectionId}`;
}

export const generateEdgeAudio = (text: string, voice: string = "zh-CN-XiaoxiaoNeural"): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const connectionId = generateUuid();
    const requestId = connectionId.replace(/-/g, '');
    
    // Get Intelligent URL
    const wsUrl = getWebsocketUrl(connectionId);
    console.log(`[EdgeTTS] Connecting to: ${wsUrl.split('?')[0]}...`); // Log base URL for debug

    const ws = new WebSocket(wsUrl);
    
    const audioChunks: BlobPart[] = [];
    let hasReceivedEnd = false;
    
    // Timeout safeguard (15 seconds)
    const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
            ws.close();
            reject(new Error("Edge TTS request timed out. Check your proxy/network settings."));
        }
    }, 15000);

    ws.onopen = () => {
      const configData = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false"
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3"
            }
          }
        }
      };
      
      const timestamp = new Date().toString(); 
      
      // Send Configuration with correct spacing
      const configMessage = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(configData)}`;
      ws.send(configMessage);

      // Send SSML
      const safeText = escapeXML(text);
      const ssml = `
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
          <voice name='${voice}'>
            ${safeText}
          </voice>
        </speak>
      `;

      const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMessage);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const message = event.data;
        if (message.includes("Path:turn.end")) {
          // Done
          hasReceivedEnd = true;
          clearTimeout(timeoutId);
          ws.close();
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
          resolve(audioBlob);
        }
      } else if (event.data instanceof Blob) {
        // Binary audio data
        const arrayBuffer = await event.data.arrayBuffer();
        const view = new DataView(arrayBuffer);
        const headLength = view.getInt16(0); // Header length is in first 2 bytes (Big Endian)
        
        // Check if header exists
        if (arrayBuffer.byteLength > headLength + 2) {
             const headerBytes = new Uint8Array(arrayBuffer.slice(2, 2 + headLength));
             const decoder = new TextDecoder();
             const headerStr = decoder.decode(headerBytes);
             
             // Only collect if it's actual audio data
             if (headerStr.includes("Path:audio")) {
                 const audioData = arrayBuffer.slice(headLength + 2);
                 audioChunks.push(audioData);
             }
        }
      }
    };

    ws.onerror = (event) => {
      // Improved error logging
      console.warn("Edge TTS WebSocket Error. If using a local IP, ensure it forwards to speech.platform.bing.com:443");
    };

    ws.onclose = (event) => {
       clearTimeout(timeoutId);
       if (!hasReceivedEnd) {
           // If closed unexpectedly but we have data, we might still want to return it
           if (audioChunks.length > 0) {
               console.warn("Edge TTS closed early, but returning partial audio.");
               const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
               resolve(audioBlob);
           } else {
               reject(new Error(`Edge TTS connection closed unexpectedly (Code: ${event.code})`));
           }
       }
    };
  });
};
