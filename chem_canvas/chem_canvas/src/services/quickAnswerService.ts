import { getSharedGeminiApiKey, assignRandomApiKey } from '../firebase/apiKeys';

/**
 * Get a precise, concise answer from Gemini 2.5 Flash
 * Optimized for handwriting display - keeps responses short and clear
 */
export async function getQuickAnswer(question: string): Promise<string> {
  // Fetch API key from Firebase
  let apiKey = await getSharedGeminiApiKey();
  if (!apiKey) {
    apiKey = await assignRandomApiKey();
  }

  if (!apiKey) {
    throw new Error("API Key not found. Please ensure you have a valid session.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a helpful chemistry tutor. Answer the following question precisely and concisely. 
Keep your answer SHORT (max 3-4 sentences) as it will be displayed as handwritten text.
Focus on the key points only. Use simple, clear language.

Question: ${question}

Provide a direct, precise answer:`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 200,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to get answer from Gemini');
  }

  const data = await response.json();
  
  // Extract the text response
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error('No response generated');
  }

  return textResponse.trim();
}

/**
 * Stream answer from Gemini 2.5 Flash (for longer responses)
 */
export async function streamQuickAnswer(
  question: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Fetch API key from Firebase
    let apiKey = await getSharedGeminiApiKey();
    if (!apiKey) {
      apiKey = await assignRandomApiKey();
    }

    if (!apiKey) {
      throw new Error("API Key not found. Please ensure you have a valid session.");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a helpful chemistry tutor. Answer the following question precisely and concisely.
Keep your answer SHORT (max 3-4 sentences) as it will be displayed as handwritten text.
Focus on the key points only. Use simple, clear language.

Question: ${question}

Provide a direct, precise answer:`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get answer from Gemini');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // Parse SSE format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }

    onComplete(fullText.trim());
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
