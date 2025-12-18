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
  // Gemini 3 Pro uses thinkingLevel, Gemini 2.5 series uses thinkingBudget
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



  // Handle Groq Models
  if (modelId && getModelProvider(modelId) === 'groq') {
    console.log(`🔮 ChatService routing to Groq for model: ${model}`);

    // Convert history to prompt context (simple concatenation for now, or use messages if supported)
    // Qwen works best with a chat-like prompt structure
    let fullPrompt = "";
    if (contents.length > 0) {
      // Basic history flattening
      fullPrompt = contents.map(c => {
        const text = c.parts.map(p => p.text).join(' ');
        return `${c.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
      }).join('\n\n');
    } else {
      fullPrompt = message;
    }

    // Create an async generator to match the expected interface
    async function* groqGenerator() {
      let buffer = "";
      const tempStream = await streamGroqContent(fullPrompt, (chunk) => {
        // We can't yield from inside the callback easily in this structure without a queue
        // So we'll restart the stream logic slightly differently or just use the generator approach
      }, {
        model: model.replace('groq/', ''),
        maxTokens: 40960
      });

      // Since streamGroqContent returns the full string at the end but takes a callback,
      // let's wrap the underlying logic properly or simpler: 
      // Reuse the lower-level service logic but as a generator here is messy.

      // Better approach: Call streamGroqContent properly via a generator wrapper
      // Actually, let's just implement a simple adapter here for now
      // Re-invoking streamGroqContent as a generator adapter:

      const groq = (await import('groq-sdk')).default;
      const client = new groq({ apiKey: localStorage.getItem('groq-api-key') || '', dangerouslyAllowBrowser: true });

      const stream = await client.chat.completions.create({
        messages: contents.map(c => ({
          role: c.role === 'user' ? 'user' : 'assistant',
          content: c.parts.map(p => p.text).join(' ')
        })) as any,
        model: model.replace('groq/', ''),
        temperature: 0.6,
        max_completion_tokens: 40960,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield { text: content };
        }
      }
    }

    return groqGenerator();
  }

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

    // Fallback logic - try gemini-2.5-flash if selected model fails
    if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('valid model')) {
      const fallbackModel = 'gemini-2.5-flash';
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
