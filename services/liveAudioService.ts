
import { getAI } from "./geminiService";

// Groq Whisper Configuration
const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// PlayAI (PlayHT) Configuration
const PLAYAI_TTS_URL = "https://api.play.ht/api/v2/tts/stream";

export const transcribeAudioWithGroq = async (audioBlob: Blob): Promise<string> => {
  const apiKey = localStorage.getItem('groq_api_key');
  if (!apiKey) throw new Error("Groq API Key not found");

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq STT Error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.text || "";
};

export const generatePlayAiAudio = async (text: string): Promise<Blob> => {
  const apiKey = localStorage.getItem('playai_api_key');
  const userId = localStorage.getItem('playai_user_id');
  const voiceId = localStorage.getItem('playai_voice_id') || 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json';

  if (!apiKey || !userId) throw new Error("PlayAI/PlayHT Credentials not found");

  const response = await fetch(PLAYAI_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-User-ID': userId,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text,
      voice: voiceId,
      output_format: 'mp3',
      quality: 'medium'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PlayAI TTS Error: ${response.status} ${errorText}`);
  }

  return await response.blob();
};

export class VoiceActivityDetector {
  private audioContext: AudioContext;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isSpeaking: boolean = false;
  private silenceStartTime: number = 0;
  private speechStartTime: number = 0;
  
  // Config
  private readonly silenceThreshold = 0.02; // RMS threshold
  private readonly silenceDelay = 1500; // ms to wait before considering speech ended
  private readonly minSpeechDuration = 500; // ms

  public onSpeechStart: () => void = () => {};
  public onSpeechEnd: () => void = () => {};
  public onAudioProcess: (level: number) => void = () => {};

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  start(stream: MediaStream) {
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);
      this.onAudioProcess(rms);

      if (rms > this.silenceThreshold) {
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.speechStartTime = Date.now();
          this.onSpeechStart();
        }
        this.silenceStartTime = 0;
      } else {
        if (this.isSpeaking) {
          if (this.silenceStartTime === 0) {
            this.silenceStartTime = Date.now();
          } else if (Date.now() - this.silenceStartTime > this.silenceDelay) {
            // Speech ended
            if (Date.now() - this.speechStartTime > this.minSpeechDuration) {
               this.isSpeaking = false;
               this.onSpeechEnd();
            } else {
               // Too short, ignore or reset
               this.isSpeaking = false; 
            }
            this.silenceStartTime = 0;
          }
        }
      }
    };

    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.processor && this.mediaStreamSource) {
        this.processor.disconnect();
        this.mediaStreamSource.disconnect();
    }
  }
}

export class LiveAudioStreamer {
  private audioContext: AudioContext;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioData: (base64: string) => void;

  constructor(audioContext: AudioContext, onAudioData: (base64: string) => void) {
    this.audioContext = audioContext;
    this.onAudioData = onAudioData;
  }

  async start(stream: MediaStream) {
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    // Gemini Live API expects 16kHz mono PCM
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Resample from current sample rate to 16000
      const resampledData = this.resample(inputData, this.audioContext.sampleRate, 16000);
      
      // Convert Float32 to Int16
      const int16Data = new Int16Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        const s = Math.max(-1, Math.min(1, resampledData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to Base64
      const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)));
      this.onAudioData(base64);
    };

    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return data;
    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      result[i] = data[Math.round(i * ratio)];
    }
    return result;
  }

  stop() {
    if (this.processor && this.mediaStreamSource) {
      this.processor.disconnect();
      this.mediaStreamSource.disconnect();
    }
  }
}
