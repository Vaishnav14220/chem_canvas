import { getSharedGeminiApiKey } from '../firebase/apiKeys';

/**
 * Get a precise, concise answer from Gemini 2.0 Flash
 * Optimized for handwriting display - keeps responses short and clear
 */
export async function getQuickAnswer(question: string): Promise<string> {
  console.log('🎯 QuickAnswer: Starting for question:', question.substring(0, 50) + '...');
  
  // Fetch API key from Firebase
  let apiKey: string;
  try {
    apiKey = await getSharedGeminiApiKey();
    console.log('✅ QuickAnswer: Got API key:', apiKey?.substring(0, 10) + '...');
  } catch (error) {
    console.error('❌ QuickAnswer: Failed to get API key:', error);
    throw new Error("Could not retrieve API key from Firebase");
  }

  if (!apiKey) {
    throw new Error("API Key not found. Please ensure you have a valid session.");
  }

  try {
    console.log('📡 QuickAnswer: Making API request...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
                  text: `You are a helpful tutor. Answer the following question precisely and concisely. 
Keep your answer SHORT (max 2-3 sentences) as it will be displayed as handwritten text on a canvas.
Focus on the key points only. Use simple, clear language. No bullet points or special formatting.

Question: ${question}

Answer directly:`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 150,
          },
        }),
      }
    );

    console.log('📡 QuickAnswer: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ QuickAnswer: API error:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ QuickAnswer: Got response data:', JSON.stringify(data).substring(0, 200));
    
    // Extract the text response
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      console.error('❌ QuickAnswer: No text in response:', data);
      throw new Error('No response generated');
    }

    console.log('✅ QuickAnswer: Final answer:', textResponse.substring(0, 100) + '...');
    return textResponse.trim();
  } catch (error) {
    console.error('❌ QuickAnswer: Error during API call:', error);
    throw error;
  }
}

/**
 * Stream answer from Gemini 2.0 Flash (for longer responses)
 */
export async function streamQuickAnswer(
  question: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Fetch API key from Firebase
    const apiKey = await getSharedGeminiApiKey();

    if (!apiKey) {
      throw new Error("API Key not found. Please ensure you have a valid session.");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}`,
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
                  text: `You are a helpful tutor. Answer the following question precisely and concisely.
Keep your answer SHORT (max 2-3 sentences) as it will be displayed as handwritten text.
Focus on the key points only. Use simple, clear language. No bullet points or special formatting.

Question: ${question}

Answer directly:`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 150,
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
