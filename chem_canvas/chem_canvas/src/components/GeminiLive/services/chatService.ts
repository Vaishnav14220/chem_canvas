import { GoogleGenAI } from "@google/genai";
import { ChatMode } from "../types";

export async function generateChatResponseStream(
  history: { role: string; parts: any[] }[],
  message: string,
  image: string | null,
  mode: ChatMode,
  apiKey: string
) {
  if (!apiKey) {
    throw new Error('No API key provided. Please wait for Firebase to load.');
  }

  console.log(`🔑 ChatService using API key: ${apiKey.substring(0, 10)}...`);
  const ai = new GoogleGenAI({ apiKey });

  let model = 'gemini-flash-lite-latest';
  let tools: any = undefined;

  // Model Selection Strategy
  if (mode === 'PRO') {
    model = 'gemini-1.5-pro'; // Use stable Pro model
  } else if (mode === 'SEARCH') {
    model = 'gemini-1.5-flash'; // Use stable Flash model
    tools = [{ googleSearch: {} }];
  } else {
    model = 'gemini-1.5-flash'; // Use stable Flash model instead of lite
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
