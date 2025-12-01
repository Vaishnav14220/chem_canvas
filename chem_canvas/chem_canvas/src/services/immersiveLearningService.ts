import { generateTextContent, extractJsonBlock } from './geminiService';

export interface InteractiveWidget {
  type: 'reveal' | 'comparison' | 'quiz';
  data: {
    title?: string;
    content?: string; // For reveal
    beforeLabel?: string; // For comparison
    afterLabel?: string; // For comparison
    beforeImagePrompt?: string; // For comparison
    afterImagePrompt?: string; // For comparison
    question?: string; // For quiz
    options?: string[]; // For quiz
    correctIndex?: number; // For quiz
    explanation?: string; // For quiz
  };
}

export interface ImmersiveSection {
  id: string;
  title: string;
  content: string;
  imagePrompt?: string;
  widget?: InteractiveWidget;
}

export interface ImmersiveContent {
  sections: ImmersiveSection[];
  keyTerms: { term: string; definition: string }[];
  contextNotes: { paragraphIndex: number; note: string }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export const analyzeDocumentForImmersive = async (text: string): Promise<ImmersiveContent> => {
  const prompt = `
    Analyze the following educational text and structure it for an immersive learning experience (Target Audience: High School/Undergraduate).
    
    Return a JSON object with the following structure:
    {
      "sections": [
        { 
          "id": "unique_id", 
          "title": "Section Title", 
          "content": "Full text of the section... Insert {{INTERACTIVE_WIDGET}} marker where the widget should appear.",
          "imagePrompt": "A detailed, photorealistic description of an image that illustrates this section's concept.",
          "widget": {
            "type": "reveal" | "comparison" | "quiz",
            "data": {
              // For 'reveal':
              "title": "Did you know?",
              "content": "Surprising fact or hidden detail...",
              
              // For 'comparison' (e.g. Before/After reaction, Healthy/Diseased cell):
              "beforeLabel": "Reactants",
              "afterLabel": "Products",
              "beforeImagePrompt": "Description of state A",
              "afterImagePrompt": "Description of state B",

              // For 'quiz' (Quick check for understanding):
              "question": "Quick check: ...?",
              "options": ["A", "B", "C"],
              "correctIndex": 0,
              "explanation": "Why it's correct..."
            }
          }
        }
      ],
      "keyTerms": [
        { "term": "Term to underline", "definition": "Concise definition..." }
      ],
      "contextNotes": [
        { "paragraphIndex": 0, "note": "Interesting fact or context about this part..." }
      ]
    }

    Rules:
    1. Split text into logical sections.
    2. For EACH section, include ONE interactive widget that best fits the content:
       - Use 'reveal' for surprising facts or "aha!" moments.
       - Use 'comparison' for processes, reactions, or before/after scenarios.
       - Use 'quiz' for complex concepts that need immediate checking.
    3. Insert {{INTERACTIVE_WIDGET}} in the 'content' string where the widget should be rendered.
    4. Generate high-quality image prompts.

    Text to Analyze:
    ${text.slice(0, 15000)}
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);
  return JSON.parse(json);
};

export const generateImmersiveQuiz = async (text: string): Promise<QuizQuestion[]> => {
  const prompt = `
    Generate a 5-question multiple-choice quiz based on the following text.
    
    Return a JSON array of objects:
    [
      {
        "question": "Question text?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswerIndex": 0,
        "explanation": "Brief explanation of why the correct answer is right."
      }
    ]

    Rules:
    - Include a clear explanation for the correct answer.
    - Questions should test understanding.

    Text:
    ${text.slice(0, 10000)}
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);
  return JSON.parse(json);
};

export const generateAudioScript = async (text: string): Promise<string> => {
  const prompt = `
    Convert the following educational text into an engaging audio lesson script.
    The script should be conversational, like a podcast host explaining the topic to a student.
    Use clear, spoken-word language.
    
    Text:
    ${text.slice(0, 10000)}
  `;

  return await generateTextContent(prompt);
};

export const generateMindMapData = async (text: string): Promise<MindMapNode> => {
  const prompt = `
    Create a hierarchical mind map structure from the following text.
    
    Return a JSON object representing the root node:
    {
      "id": "root",
      "label": "Main Topic",
      "children": [
        { "id": "child1", "label": "Subtopic 1", "children": [...] }
      ]
    }

    Text:
    ${text.slice(0, 10000)}
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);
  return JSON.parse(json);
};

// Simulating "nanao babanana pro 3" image generation using a public API
export const generateImmersiveImage = async (prompt: string): Promise<string> => {
  // In a real scenario with a specific model, we would call that API here.
  // For now, we use Pollinations AI to generate an image on the fly based on the prompt.
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
};
