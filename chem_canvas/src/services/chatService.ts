import { GoogleGenAI } from "@google/genai";
import { ChatMode } from "../components/GeminiLive/types";
import { getSharedGeminiApiKey, assignRandomApiKey } from '../firebase/apiKeys';

export async function generateChatResponseStream(
  history: { role: string; parts: any[] }[],
  message: string,
  image: string | null,
  mode: ChatMode
) {
  // Fetch API key from Firebase
  let apiKey = await getSharedGeminiApiKey();
  if (!apiKey) {
    apiKey = await assignRandomApiKey();
  }

  if (!apiKey) {
    throw new Error("API Key not found. Please ensure you have a valid session.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  let model = 'gemini-2.5-flash';
  let tools: any = undefined;

  // Model Selection Strategy
  if (mode === 'PRO') {
    model = 'gemini-2.5-pro'; // For complex reasoning and image analysis
  } else if (mode === 'SEARCH') {
    model = 'gemini-2.5-flash'; // For Search Grounding
    tools = [{ googleSearch: {} }];
  } else {
    model = 'gemini-2.5-flash'; // For fast, low-latency text
  }

  // Construct Content
  const contents = [...history];

  const userParts: any[] = [{ text: message }];

  // Add Image if present
  if (image) {
    // Extract base64 data from Data URI
    const base64Data = image.split(',')[1];
    const mimeType = image.split(';')[0].split(':')[1];

    userParts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  contents.push({ role: 'user', parts: userParts });

  try {
    const result = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        tools,
        systemInstruction: "You are a helpful chemistry tutor. When using search, provide up-to-date information.",
      }
    });

    return result;
  } catch (error) {
    console.error("Chat generation error:", error);
    throw error;
  }
}
