
export const generateGoogleCloudAudio = async (text: string, apiKey: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("Google Cloud TTS API Key is missing.");
  }

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const requestBody = {
    input: {
      text: text
    },
    voice: {
      languageCode: "zh-CN",
      name: "zh-CN-Wavenet-A" // Default to a high-quality WaveNet voice
    },
    audioConfig: {
      audioEncoding: "MP3"
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Google TTS Error: ${response.status}`);
    }

    const data = await response.json();
    return data.audioContent; // Returns base64 string
  } catch (error) {
    console.error("Google Cloud TTS failed:", error);
    throw error;
  }
};
