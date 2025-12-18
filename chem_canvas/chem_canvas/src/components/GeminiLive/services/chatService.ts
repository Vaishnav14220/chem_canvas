import { GoogleGenAI } from "@google/genai";
import { ChatMode } from "../types";
import { GeminiModelId, buildThinkingConfig, getDefaultModelId, getModelProvider } from "../../../types/modelTypes";
import { streamGroqContent } from "../../../services/groqService";

export async function generateChatResponseStream(
  history: { role: string; parts: any[] }[],
  message: string,
  image: string | null,
  mode: ChatMode,
  apiKey: string,
  modelId?: GeminiModelId
) {
  if (!apiKey) {
    throw new Error('No API key provided. Please wait for Firebase to load.');
  }

  console.log(`🔑 ChatService using API key: ${apiKey.substring(0, 10)}...`);
  const ai = new GoogleGenAI({ apiKey });

  // Use explicit model if provided, otherwise use default
  let model: string = modelId || getDefaultModelId();
  let tools: any = undefined;

  // Mode-based adjustments (SEARCH enables Google Search grounding)
  if (mode === 'SEARCH') {
    tools = [{ googleSearch: {} }];
  }

  // Build thinking configuration based on model type
  // Gemini 3 Pro uses thinkingLevel, Gemini 3 Flash uses thinkingBudget
  const thinkingConfig = buildThinkingConfig(model as GeminiModelId);

  console.log(`🤖 ChatService using model: ${model}`);
  console.log(`🧠 Thinking config:`, thinkingConfig);

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
        thinkingConfig,
        systemInstruction: "You are a helpful chemistry tutor. When using search, provide up-to-date information. Use LaTeX for math/chemistry.",
      }
    });

    return result;
  } catch (error: any) {
    console.error("Chat generation error:", error);

    // Fallback logic - try gemini-3-flash-preview if selected model fails
    if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('valid model')) {
      const fallbackModel = 'gemini-3-flash-preview';
      console.log(`⚠️ Model ${model} not found, falling back to ${fallbackModel}`);
      try {
        const fallbackThinkingConfig = buildThinkingConfig(fallbackModel);
        const fallbackResult = await ai.models.generateContentStream({
          model: fallbackModel,
          contents,
          config: {
            tools,
            thinkingConfig: fallbackThinkingConfig,
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
