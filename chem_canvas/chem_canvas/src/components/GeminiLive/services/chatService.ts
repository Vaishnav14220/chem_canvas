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

  let model = 'gemini-2.5-flash'; // Default to latest Flash
  let tools: any = undefined;

  // Model Selection Strategy
  if (mode === 'PRO') {
    model = 'gemini-2.5-pro'; // Use Pro model for complex reasoning
  } else if (mode === 'SEARCH') {
    model = 'gemini-2.5-flash'; // Use Flash with search
    tools = [{ googleSearch: {} }];
  } else {
    // FAST mode
    model = 'gemini-2.5-flash'; 
  }

  console.log(`🤖 ChatService using model: ${model}`);

  // Construct Content
  const contents = [...history];

  const userParts: any[] = [{ text: message }];

  // Add Image if present
  if (image) {
    // Extract base64 data from Data URI
    try {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      userParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    } catch (e) {
      console.error("Failed to process image data", e);
    }
  }

  contents.push({ role: 'user', parts: userParts });

  try {
    const result = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        tools,
        systemInstruction: "You are a helpful chemistry tutor. When using search, provide up-to-date information. Use LaTeX for math/chemistry.",
      }
    });

    return result;
  } catch (error: any) {
    console.error("Chat generation error:", error);
    
    // Fallback logic - try gemini-2.5-pro if flash fails
    if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('valid model')) {
        console.log("⚠️ Model not found, falling back to gemini-2.5-pro");
        try {
            const fallbackResult = await ai.models.generateContentStream({
                model: 'gemini-2.5-pro',
                contents,
                config: {
                    tools,
                    systemInstruction: "You are a helpful chemistry tutor.",
                }
            });
            return fallbackResult;
        } catch (fallbackError) {
            console.error("Fallback chat generation error:", fallbackError);
            throw fallbackError;
        }
    }
    throw error;
  }
}
