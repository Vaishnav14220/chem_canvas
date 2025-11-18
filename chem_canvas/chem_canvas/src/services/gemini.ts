import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

export function initializeGemini(apiKey: string) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export async function sendMessageToGemini(
  message: string,
  canvasImageData?: string,
  documentContent?: string,
  documentName?: string
): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide your API key.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = `You are a helpful chemistry assistant for students. The student is working on a chemistry canvas where they can draw molecules, write equations, and take notes.

Student's question: ${message}`;

    // Add document context if available
    if (documentContent && documentContent.trim()) {
      prompt += `\n\n📄 **REFERENCE DOCUMENT: "${documentName}"**\n${documentContent.substring(0, 8000)}\n`;
      prompt += `\n**CITATION INSTRUCTIONS:**
- When answering from the document, ALWAYS cite the page number like this: 📄 (Page X)
- Quote directly when relevant
- If information spans multiple pages, cite all relevant pages
- Make it easy for the student to find the information in their document\n`;
    }

    prompt += `\nIMPORTANT FORMATTING RULES:
1. Use LaTeX notation for mathematical expressions:
   - Inline math: $expression$ (e.g., $E = mc^2$)
   - Block math: $$expression$$ (e.g., $$\\Delta H = \\sum H_{products} - \\sum H_{reactants}$$)

2. For chemical formulas, write them normally (they will be auto-formatted):
   - Examples: H2O, CO2, CH4, NaCl
   - For states: H2O(l), CO2(g), NaCl(aq), Fe(s)

3. For chemical equations, use the arrow (→ or ->):
   - Example: 2H2 + O2 → 2H2O
   - Example: CH4 + 2O2 → CO2 + 2H2O

4. Use proper formatting:
   - **Bold** for important concepts
   - *Italic* for emphasis
   - \`code\` for specific terms or units
   - Use bullet points with - or * for lists
   - Use numbered lists with 1. 2. 3. etc.

5. Common chemistry LaTeX expressions:
   - Equilibrium: $K_{eq} = \\frac{[products]}{[reactants]}$
   - pH: $pH = -\\log[H^+]$
   - Enthalpy: $\\Delta H$, Entropy: $\\Delta S$, Gibbs: $\\Delta G$
   - Reaction rate: $rate = k[A]^m[B]^n$

Provide a clear, educational response with proper formatting that helps them understand the chemistry concepts. If they're asking about something drawn on the canvas, reference the visual elements in your explanation.`;

    let result;

    if (canvasImageData) {
      const imagePart = {
        inlineData: {
          data: canvasImageData.split(',')[1],
          mimeType: 'image/png'
        }
      };

      result = await model.generateContent([prompt, imagePart]);
    } else {
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    return response.text();
  } catch (error: any) {
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
      throw new Error('Invalid API key. Please check your Google Gemini API key.');
    }
    throw new Error(`AI Error: ${error.message || 'Failed to get response from AI'}`);
  }
}
