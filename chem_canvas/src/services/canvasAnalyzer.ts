// Canvas Analysis Service using Gemini API
export interface Correction {
  id: string;
  x: number;
  y: number;
  message: string;
  type: 'error' | 'warning' | 'suggestion';
  severity: 'low' | 'medium' | 'high';
  category: 'formula' | 'equation' | 'notation' | 'structure' | 'general';
}

export interface CanvasAnalysisResult {
  corrections: Correction[];
  overallScore: number;
  feedback: string;
  suggestions: string[];
}

// Convert canvas to base64 image data
export const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
  return canvas.toDataURL('image/png', 0.8);
};

// First, detect what content is actually on the canvas
export const detectCanvasContent = async (
  canvasData: string,
  apiKey: string
): Promise<{contentType: string, description: string, confidence: number}> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
                  text: `Look at this canvas image and identify EXACTLY what the student has written or drawn. Be very specific about what you can see.

Return ONLY a JSON object with this structure:
{
  "contentType": "text|chemical_formula|chemical_equation|mathematical|molecular_structure|drawing|mixed|empty",
  "description": "Detailed description of what you can actually see written/drawn",
  "confidence": 0.95
}

Content types:
- "text": Written words, definitions, explanations, notes, labels
- "chemical_formula": Chemical formulas like H2O, CO2, NaCl, C6H12O6
- "chemical_equation": Chemical reactions with arrows like 2H2 + O2 → 2H2O
- "mathematical": Math expressions, calculations, equations, formulas
- "molecular_structure": Molecular diagrams, Lewis structures, 3D structures, bond-line structures
- "drawing": Sketches, diagrams, illustrations, graphs, charts
- "mixed": Combination of different content types
- "empty": No clear content visible or very unclear

Be very specific in the description. For example:
- If you see "H2O" written, say "Chemical formula H2O written"
- If you see "2H2 + O2 → 2H2O", say "Chemical equation showing hydrogen and oxygen reaction"
- If you see text like "Water is H2O", say "Text explaining that water is H2O"
- If you see a molecular structure, describe what atoms and bonds you can see

Only identify what you can clearly see. Don't assume or guess.`
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: canvasData.split(',')[1]
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 300,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Content detection failed: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    try {
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();
      
      const detection = JSON.parse(cleanedText);
      return {
        contentType: detection.contentType || 'general',
        description: detection.description || 'Unknown content',
        confidence: detection.confidence || 0.5
      };
    } catch (e) {
      console.log('Could not parse content detection, using general analysis');
      return {
        contentType: 'general',
        description: 'Could not detect content type',
        confidence: 0.3
      };
    }
  } catch (error) {
    console.error('Content detection failed:', error);
    return {
      contentType: 'general',
      description: 'Detection failed',
      confidence: 0.1
    };
  }
};

// Analyze canvas content using Gemini API with content-specific analysis
export const analyzeCanvasWithLLM = async (
  canvasData: string,
  apiKey: string,
  subject: string = 'chemistry'
): Promise<CanvasAnalysisResult> => {
  try {
    // First detect what content is actually on the canvas
    const contentDetection = await detectCanvasContent(canvasData, apiKey);
    console.log('Detected content:', contentDetection);

    // Handle empty or unclear content
    if (contentDetection.contentType === 'empty' || contentDetection.confidence < 0.3) {
      return {
        corrections: [],
        overallScore: 0,
        feedback: "I can't clearly see any content on the canvas. Please write or draw something so I can help you with corrections and feedback.",
        suggestions: [
          "Try writing more clearly or with darker ink",
          "Make sure your content is visible and well-formed",
          "Consider using a larger font size for text",
          "Ensure your drawing is clear and well-defined"
        ]
      };
    }

    // Create content-specific analysis prompt
    let analysisPrompt = `You are an expert ${subject} teacher. I can see that the student has written/drawn: "${contentDetection.description}"

TASK: Analyze ONLY what is actually present and provide specific corrections for the content you can see.

ANALYSIS APPROACH:
1. Look at the specific content: ${contentDetection.description}
2. Identify any errors, mistakes, or improvements needed in that specific content
3. Provide corrections that are relevant to what was actually written/drawn

EVALUATION CRITERIA (apply only to relevant content):`;

    // Add specific criteria based on detected content type
    switch (contentDetection.contentType) {
      case 'text':
        analysisPrompt += `
- Spelling and grammar errors
- Scientific accuracy and terminology
- Clarity and completeness of explanations
- Proper use of scientific language`;
        break;
      case 'chemical_formula':
        analysisPrompt += `
- Correct element symbols (H, O, C, etc.)
- Proper subscripts for atoms (H2O not H2O)
- Correct superscripts for charges (Na+ not Na+)
- Proper notation and formatting`;
        break;
      case 'chemical_equation':
        analysisPrompt += `
- Proper balancing of atoms on both sides
- Correct arrow notation (→ not ->)
- State symbols if present (s), (l), (g), (aq)
- Proper coefficients and subscripts`;
        break;
      case 'mathematical':
        analysisPrompt += `
- Mathematical accuracy and calculations
- Proper notation and symbols
- Correct units and measurements
- Logical flow of mathematical reasoning`;
        break;
      case 'molecular_structure':
        analysisPrompt += `
- Correct bonding patterns and geometry
- Proper atom placement and connectivity
- Accurate representation of functional groups
- Correct stereochemistry if applicable`;
        break;
      case 'drawing':
        analysisPrompt += `
- Accuracy of the drawing relative to the concept
- Proper labeling and annotations
- Clarity and neatness of the representation
- Scientific accuracy of the illustration`;
        break;
      case 'mixed':
        analysisPrompt += `
- Accuracy of each type of content present
- Consistency between different content types
- Proper integration of text, formulas, equations, and drawings
- Overall coherence and completeness`;
        break;
      default:
        analysisPrompt += `
- Overall accuracy and correctness
- Proper scientific notation and terminology
- Clarity and completeness of the work`;
    }

    analysisPrompt += `

RESPONSE FORMAT:
You MUST return ONLY a valid JSON object with this exact structure:

{
  "corrections": [
    {
      "x": 150,
      "y": 100,
      "message": "Specific correction for what you can see - explain what's wrong and how to fix it",
      "type": "error|warning|suggestion",
      "severity": "low|medium|high",
      "category": "formula|equation|notation|structure|general"
    }
  ],
  "overallScore": 85,
  "feedback": "Assessment focusing specifically on the content you can see: ${contentDetection.description}",
  "suggestions": [
    "Specific improvement suggestions based on the actual content"
  ]
}

IMPORTANT GUIDELINES:
- Only analyze the content you can actually see: "${contentDetection.description}"
- Be specific about what needs to be corrected
- Explain WHY something is wrong, not just WHAT is wrong
- Provide actionable feedback that helps the student improve
- If the content looks correct, say so and provide encouragement
- Don't make assumptions about what the student intended to write
- If everything looks correct, provide positive feedback and maybe suggest extensions or related concepts

SPECIAL CASES:
- If the content is completely correct, set overallScore to 90-100 and provide encouraging feedback
- If there are minor issues, provide specific corrections with clear explanations
- If there are major errors, explain what's wrong and how to fix it step by step

Analyze the specific content you can see and provide targeted feedback.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
                  text: analysisPrompt
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: canvasData.split(',')[1] // Remove data:image/png;base64, prefix
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // Try to parse the JSON response
    try {
      // Clean up the response text - remove any markdown code blocks
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();
      
      const analysisResult = JSON.parse(cleanedText);
      
      // Add unique IDs to corrections
      const correctionsWithIds = analysisResult.corrections.map((correction: any, index: number) => ({
        ...correction,
        id: `correction-${index}-${Date.now()}`
      }));

      return {
        ...analysisResult,
        corrections: correctionsWithIds
      };
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      
      // Fallback: return a structured response even if JSON parsing fails
      return {
        corrections: [
          {
            id: `correction-fallback-${Date.now()}`,
            x: 100,
            y: 100,
            message: "Analysis completed. The LLM provided feedback but the response format was unexpected. Please check your work manually.",
            type: 'suggestion' as const,
            severity: 'low' as const,
            category: 'general' as const
          }
        ],
        overallScore: 70,
        feedback: "Analysis completed with some formatting issues. The AI has reviewed your work.",
        suggestions: [
          "Review the LLM response format",
          "Try the analysis again if needed"
        ]
      };
    }
  } catch (error) {
    console.error('Canvas analysis error:', error);
    
    // Return fallback response
    return {
      corrections: [
        {
          id: `correction-error-${Date.now()}`,
          x: 100,
          y: 100,
          message: "Unable to analyze canvas content. Please check your API key and internet connection.",
          type: 'error' as const,
          severity: 'medium' as const,
          category: 'general' as const
        }
      ],
      overallScore: 0,
      feedback: "Analysis failed due to technical issues.",
      suggestions: [
        "Check your Gemini API key in settings",
        "Ensure you have a stable internet connection",
        "Try again in a few moments"
      ]
    };
  }
};

// Get stored API key from localStorage
export const getStoredAPIKey = (): string => {
  return localStorage.getItem('gemini-api-key') || '';
};

// Store API key in localStorage
export const storeAPIKey = (apiKey: string): void => {
  localStorage.setItem('gemini-api-key', apiKey);
};

// Initialize with the provided API key
export const initializeWithProvidedAPIKey = (): void => {
  const providedApiKey = 'AIzaSyDDYVFDvc3sgJMc_HJ25QycEEDpYyFEomE';
  storeAPIKey(providedApiKey);
};