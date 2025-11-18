
import { GoogleGenAI } from "@google/genai";
import { ChatMode } from "../types";

const API_KEY = process.env.API_KEY as string;
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function generateChatResponseStream(
  history: { role: string; parts: any[] }[],
  message: string,
  image: string | null,
  mode: ChatMode
) {
  let model = 'gemini-flash-lite-latest';
  let tools: any = undefined;

  // Model Selection Strategy
  if (mode === 'PRO') {
    model = 'gemini-3-pro-preview'; // For complex reasoning and image analysis
  } else if (mode === 'SEARCH') {
    model = 'gemini-2.5-flash'; // For Search Grounding
    tools = [{ googleSearch: {} }];
  } else {
    model = 'gemini-flash-lite-latest'; // For fast, low-latency text
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
