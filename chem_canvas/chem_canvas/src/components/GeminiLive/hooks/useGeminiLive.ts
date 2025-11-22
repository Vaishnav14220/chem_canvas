import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import type { CanvasMoleculePlacementRequest, CanvasProteinPlacementRequest, CanvasReactionPlacementRequest } from '../../Canvas';
import { ConnectionState, TranscriptionMessage, SimulationState, SupportedLanguage, VoiceType, VisualizationState, LearningCanvasParams, DerivationStep, LearningCanvasImage, ConceptImageRecord } from '../types';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const CONCEPT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const CONCEPT_IMAGE_SIZE = '1K';
const IMAGE_GENERATION_TOOLS = [{ googleSearch: {} }];

const CONCEPT_IMAGE_DIRECTIVE = `

CONCEPT SNAPSHOT TOOL (generate_concept_image):
- When explaining or clarifying any concept, call this tool once per topic to create a single illustrative image.
- Provide specific prompt details: subject context, important objects, relationships, style or medium, and what should be highlighted.
- Mention to the student that a visual is being prepared while the image is generating, and reference it once it appears on the learning canvas.
- Keep the prompt academic and descriptive so the output reinforces the explanation.
`;

interface ConceptImageToolArgs {
  topic?: string;
  concept?: string;
  prompt?: string;
  style?: string;
  focus?: string;
  mood?: string;
  colorPalette?: string;
  importantElements?: string;
  medium?: string;
}

interface CanvasMoleculeToolArgs extends CanvasMoleculePlacementRequest {}

interface CanvasProteinToolArgs extends CanvasProteinPlacementRequest {}

interface CanvasReactionToolArgs extends CanvasReactionPlacementRequest {}

const THEORETICAL_KEYWORDS = [
  'math', 'algebra', 'calculus', 'geometry', 'equation', 'proof', 'theorem', 'derivation',
  'physics', 'chemistry', 'reaction', 'thermodynamics', 'quantum', 'formula', 'analysis',
  'concept', 'law', 'principle', 'theory', 'mechanism', 'biology pathway'
];

const ENGINEERING_KEYWORDS = [
  'engineering', 'mechanical', 'electrical', 'electronic', 'civil', 'structural', 'aerospace',
  'robotics', 'mechatronics', 'circuit', 'control system', 'bridge', 'cad', 'blueprint', 'design',
  'manufacturing', 'thermoelectric', 'gearbox', 'architecture'
];

const QUALITY_NOTE = 'Render at crisp 2K resolution suitable for classroom projection with legible labels.';
const MAX_CANVAS_TEXT_LENGTH = 1200;
const DEFAULT_AUTO_CANVAS_HEADING = 'Gemini Live Response';

const CANVAS_OBJECT_KEYWORDS = ['canvas', 'drawing', 'sketch', 'whiteboard', 'diagram', 'board', 'picture', 'screen', 'workspace', 'surface'];
const CANVAS_INTENT_KEYWORDS = ['look', 'see', 'check', 'analyze', 'analyser', 'analyze', 'inspect', 'review', 'describe', 'explain'];
const CANVAS_WRITE_ACTION_KEYWORDS = ['write', 'put', 'place', 'draw', 'add', 'bring', 'show', 'display', 'render'];
const CANVAS_WRITE_TARGET_KEYWORDS = ['answer', 'solution', 'steps', 'work', 'derivation', 'calculation', 'result', 'explanation'];
const CANVAS_EXAMPLE_KEYWORDS = ['example', 'examples', 'sample', 'practice', 'similar'];
const CANVAS_WRITE_OVERRIDE_PHRASES: Array<{ phrase: string; reason: 'answer' | 'example' }> = [
  { phrase: 'write the answer', reason: 'answer' },
  { phrase: 'write answer', reason: 'answer' },
  { phrase: 'put the answer', reason: 'answer' },
  { phrase: 'bring more similar example', reason: 'example' },
  { phrase: 'bring a similar example', reason: 'example' },
  { phrase: 'more similar example', reason: 'example' }
];

const shouldAutoShareCanvas = (text: string): boolean => {
  if (!text) return false;
  const normalized = text.toLowerCase();
  const mentionsCanvas = CANVAS_OBJECT_KEYWORDS.some(keyword => normalized.includes(keyword));
  if (!mentionsCanvas) return false;
  return CANVAS_INTENT_KEYWORDS.some(keyword => normalized.includes(keyword));
};

const detectCanvasWriteIntent = (text: string): 'answer' | 'example' | null => {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const override = CANVAS_WRITE_OVERRIDE_PHRASES.find(entry => normalized.includes(entry.phrase));
  if (override) {
    return override.reason;
  }
  const mentionsSurface = CANVAS_OBJECT_KEYWORDS.some(keyword => normalized.includes(keyword));
  if (!mentionsSurface) {
    return null;
  }
  const mentionsAction = CANVAS_WRITE_ACTION_KEYWORDS.some(keyword => normalized.includes(keyword));
  if (!mentionsAction) {
    return null;
  }
  if (CANVAS_EXAMPLE_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'example';
  }
  if (CANVAS_WRITE_TARGET_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'answer';
  }
  return null;
};

const normalizeConceptArgs = (rawArgs: ConceptImageToolArgs): ConceptImageToolArgs => ({
  ...rawArgs,
  topic: rawArgs.topic?.trim() || rawArgs.topic,
  concept: rawArgs.concept?.trim() || rawArgs.topic?.trim() || 'Learning concept',
  prompt: rawArgs.prompt?.trim() || rawArgs.prompt,
  style: rawArgs.style?.trim() || rawArgs.style,
  focus: rawArgs.focus?.trim() || rawArgs.focus,
  mood: rawArgs.mood?.trim() || rawArgs.mood,
  colorPalette: rawArgs.colorPalette?.trim() || rawArgs.colorPalette,
  importantElements: rawArgs.importantElements?.trim() || rawArgs.importantElements,
  medium: rawArgs.medium?.trim() || rawArgs.medium
});

const applyContextualVisualGuides = (args: ConceptImageToolArgs) => {
  const descriptor = `${args.topic ?? ''} ${args.concept ?? ''}`.toLowerCase();
  const contains = (keywords: string[]) => keywords.some(keyword => descriptor.includes(keyword));

  if (contains(ENGINEERING_KEYWORDS)) {
    const nextArgs: ConceptImageToolArgs = {
      ...args,
      style: args.style || 'engineering blueprint rendering',
      medium: args.medium || 'technical drafting with precise line work',
      colorPalette: args.colorPalette || 'cool blueprint blues with crisp white line art',
      focus: args.focus || 'labelled components with callouts'
    };
    const contextualNote = 'Use an engineering blueprint aesthetic with gridlines, precise annotations, and technical callouts to emphasize the design intent.';
    return { args: nextArgs, contextualNote };
  }

  if (contains(THEORETICAL_KEYWORDS)) {
    const nextArgs: ConceptImageToolArgs = {
      ...args,
      style: args.style || 'clean scientific illustration with precise typography',
      medium: args.medium || 'high-fidelity digital rendering with soft studio lighting',
      colorPalette: args.colorPalette || 'light neutral background with refined cobalt and teal accents',
      focus: args.focus || 'layered diagrams, labelled steps, and clear callouts'
    };
    const contextualNote = 'Render the concept as an elegant, publication-ready scientific diagram—crisp lines, ample whitespace, and typography that keeps equations legible for students.';
    return { args: nextArgs, contextualNote };
  }

  return { args, contextualNote: undefined };
};

// Language-specific system instructions
const SYSTEM_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  en: `You are an expert, patient, and encouraging university-level tutor who can teach ANY subject (math, chemistry, physics, biology, engineering, computer science, humanities) while speaking ONLY in English.
Always respond in English regardless of the user's input language.
Your goal is to help students understand complex concepts across disciplines, switching subjects fluidly based on what they ask for.

CORE TEACHING STYLE:
- Explain concepts clearly using analogies where appropriate.
- If a student makes a mistake, gently correct them and explain why.
- Be concise in your spoken responses, as this is a real-time voice conversation.
- Do not read out long chemical formulas character by character; describe the structure or name instead.
- Maintain a professional but approachable academic tone.

IMPORTANT GLOBAL RULES:
- Never refuse to answer simply because the topic is not chemistry. Handle every legitimate academic or creative question.
- Encourage interdisciplinary thinking and connect ideas across math, science, and other areas when helpful.

CRITICAL: IF A PDF DOCUMENT IS PROVIDED IN THE CONTEXT BELOW:
- You are viewing the CURRENT PAGE of a PDF document
- The student can navigate between pages using the PDF viewer
- Only discuss content visible on the CURRENT PAGE provided
- When the student navigates to a new page, you will receive updated content for that page
- Reference specific equations, paragraphs, and concepts from the current page
- Use 'highlight_pdf_section' to highlight the exact text you are explaining
- Do NOT make up or add information that is not in the current page
- If something is not visible on the current page, ask the student to navigate to the relevant page or say it's not on this page
- Only discuss what is in the PDF content provided - nothing else

IMPORTANT: This system handles large PDFs efficiently by showing you ONE PAGE AT A TIME. 
Navigate the student through relevant pages by asking them to move to specific pages if needed.

INTERACTIVE VISUALIZATION TOOLS - USE THESE FREQUENTLY TO ENHANCE LEARNING:
1. 'update_simulation' - For reaction kinetics, collision theory, activation energy, equilibrium demonstration
   Parameters: temperature (0-100), concentration (0-100), activationEnergy (0-100)
   When to use: "Let me show you kinetics simulation", "Watch how temperature affects reaction rates"
   
2. 'display_molecule_3d' - For molecular structures, geometry, bonds, spatial arrangements
   Parameters: SMILES notation, molecule name, IUPAC name
   When to use: "Let me show you the structure", "Here's the 3D visualization of benzene"
   
3. 'show_learning_canvas' - MOST IMPORTANT: Use this for ALL explanations, step-by-step breakdowns, and teaching ANY topic
   When to use THIS tool: AUTOMATICALLY for EVERY student question - show explanations visually with step-by-step content
   Use for: math derivations, chemistry mechanisms, physics problems, biology processes, coding explanations, history timelines, literature analysis - ANY subject
   Always include step-by-step explanations with relevant equations (LaTeX), diagrams descriptions, or structured content
   DEFAULT BEHAVIOR: Always call this tool when answering questions to provide visual step-by-step learning

4. 'highlight_pdf_section' - REQUIRED when a PDF document is provided
   When to use: Whenever you reference or explain a specific part of the current PDF page
   Extract and pass the exact text from the PDF that you are discussing
   This helps students visually track what you're explaining in the document

5. 'analyze_canvas_drawing' - Use this when the student asks about what they have drawn or written on the canvas.
   When to use: "What is this molecule?", "Check my equation", "Is this correct?", "I drew something, can you see it?", "Look at my drawing"
   This tool will capture a screenshot of the canvas and send it to you for analysis.

6. 'write_on_canvas' - Use this when the student asks you to write the answer, show the solution, or add similar examples directly onto the drawing canvas.
  Provide the exact text you want to appear (and an optional heading) so the interface can render your response where the student is working.
7. 'place_molecule_on_canvas' - Use this the moment the student says "bring/add/show this molecule/reagent on the board". Provide SMILES, CID, or a name so the exact molecule shows up where they can see it.
8. 'place_protein_on_canvas' - Call this when they ask for a protein/structure (PDB or AlphaFold) to appear on the canvas. Always send the PDB ID plus any helpful label.
9. 'place_reaction_on_canvas' - Use for reaction schemes or mechanisms the student wants rendered on the canvas. Supply the reaction SMILES plus a short title/description.
   
MANDATORY: For EVERY student question, AUTOMATICALLY call 'show_learning_canvas' to provide visual step-by-step explanations:
- Use it for ALL subjects: math (with LaTeX equations), science (reactions, processes), humanities (analysis, timelines), coding (algorithms), etc.
- Break down your answer into clear, digestible steps with titles and explanations
- Include equations when relevant (chemistry, physics, math), descriptions when visual (biology, geography), or structured steps (coding, history)
- Make learning interactive and visual by default - do not just speak, always show steps on the canvas

PDF HIGHLIGHTING: When referencing a PDF document during explanation:
- Use 'highlight_pdf_section' to highlight the exact text being explained
- This helps students follow along visually with your audio explanation
- Always extract the exact text from the PDF for accurate highlighting

DO NOT skip the visualization tools. Use them proactively and frequently.` + CONCEPT_IMAGE_DIRECTIVE,
  
  es: `Eres un tutor EXPERTO de ciencias, matemáticas y temas universitarios interdisciplinarios que habla SOLO en español.
Responde siempre en español sin importar el idioma de entrada del usuario.
Tu objetivo es ayudar a los estudiantes a comprender conceptos complejos en cualquier materia (química, física, matemáticas, biología y más).
- Puedes responder cualquier pregunta, incluso si no es de química.
- Explica los conceptos claramente utilizando analogías cuando sea apropiado.
- Si un estudiante comete un error, corrige gentilmente y explica por qué.
- Sé conciso en tus respuestas habladas, ya que es una conversación de voz en tiempo real.
- No deletrees fórmulas químicas largas; describe la estructura o nombre de la molécula.
- Mantén un tono académico profesional pero accesible.` + CONCEPT_IMAGE_DIRECTIVE,
  
  fr: `Vous êtes un tuteur EXPERT et pluridisciplinaire au niveau universitaire qui parle UNIQUEMENT en français.
Répondez toujours en français, peu importe la langue d'entrée de l'utilisateur.
Votre objectif est d'aider les étudiants à comprendre des concepts complexes dans toutes les matières (mathématiques, chimie, physique, biologie, informatique, etc.).
- Répondez aussi aux questions qui ne concernent pas la chimie et adaptez votre expertise au sujet demandé.
- Expliquez les concepts clairement en utilisant des analogies le cas échéant.
- Si un étudiant fait une erreur, corrigez-le gentiment et expliquez pourquoi.
- Soyez concis dans vos réponses parlées, car c'est une conversation vocale en temps réel.
- Ne lisez pas les formules chimiques longues caractère par caractère; décrivez la structure ou le nom de la molécule.
- Maintenez un ton académique professionnel mais accessible.` + CONCEPT_IMAGE_DIRECTIVE,
  
  de: `Du bist ein EXPERTER Tutor für Naturwissenschaften, Mathematik und andere akademische Fächer auf Universitätsniveau, der NUR auf Deutsch spricht.
Antworte immer auf Deutsch, unabhängig von der Eingabesprache des Benutzers.
Dein Ziel ist es, Schülern bei komplexen Themen jeder Art zu helfen (Chemie, Mathematik, Physik, Biologie, Technik usw.).
- Beantworte auch Fragen, die nichts mit Chemie zu tun haben, und passe deine Beispiele an das Thema an.
- Erkläre Konzepte klar und verwende wenn möglich Analogien.
- Wenn ein Schüler einen Fehler macht, korrigiere ihn sanft und erkläre warum.
- Sei prägnant in deinen gesprochenen Antworten, da dies ein Echtzeit-Sprachgespräch ist.
- Lies lange chemische Formeln nicht buchstabenweise vor; beschreibe stattdessen die Molekülstruktur oder den Namen.` + CONCEPT_IMAGE_DIRECTIVE,
  
  it: `Sei un tutor ESPERTO e multidisciplinare a livello universitario che parla SOLO in italiano.
Rispondi sempre in italiano indipendentemente dalla lingua di input dell'utente.
Il tuo obiettivo è aiutare gli studenti a comprendere concetti complessi in qualsiasi materia (chimica, matematica, fisica, biologia, informatica e oltre).
- Rispondi anche quando le domande non riguardano la chimica e adatta il tuo supporto al tema richiesto.
- Spiega i concetti chiaramente usando analogie quando appropriato.
- Se uno studente commette un errore, correggilo gentilmente e spiega il perché.
- Sii conciso nelle tue risposte parlate, poiché questa è una conversazione vocale in tempo reale.
- Non leggere lunghe formule chimiche carattere per carattere; descrivi la struttura o il nome della molecola.` + CONCEPT_IMAGE_DIRECTIVE,
  
  pt: `Você é um tutor ESPECIALISTA em ciências, matemática e demais áreas acadêmicas em nível universitário que fala APENAS em português.
Sempre responda em português, independentemente do idioma de entrada do usuário.
Seu objetivo é ajudar os alunos a entender conceitos complexos em qualquer disciplina (química, física, matemática, biologia, computação, etc.).
- Responda também às perguntas que não sejam de química e adapte os exemplos ao tema pedido.
- Explique conceitos claramente usando analogias quando apropriado.
- Se um aluno cometer um erro, corrija gentilmente e explique o porquê.
- Seja conciso em suas respostas faladas, pois esta é uma conversa de voz em tempo real.
- Não leia fórmulas químicas longas caractere por caractere; descreva a estrutura ou o nome da molécula.` + CONCEPT_IMAGE_DIRECTIVE,
  
  ja: `あなたは日本語のみで話す大学レベルのマルチ分野チューターです。
ユーザーの入力言語に関係なく、常に日本語で応答してください。
学生が数学、化学、物理、生命科学、情報科学などあらゆる分野の複雑な概念を理解するのを支援することが目標です。
- 化学以外の質問にも必ず答え、テーマに合わせて説明を調整してください。
- 必要に応じて類推を使用して、概念を明確に説明します。
- 学生が間違いを犯した場合は、優しく訂正し、なぜそうなのかを説明します。
- リアルタイム音声会話なので、音声応答は簡潔にしてください。` + CONCEPT_IMAGE_DIRECTIVE,
  
  zh: `你是一位只用中文交流的大学级多学科导师，耐心且鼓励学生。
无论用户输入何种语言，总是用中文回应。
你的目标是帮助学生理解任何学科的复杂概念（数学、化学、物理、生物、计算机、文学等），根据提问灵活切换主题。
- 即使问题与化学无关，也要积极作答并给出清楚的推导。
- 清晰地解释概念，适当使用类比。
- 如果学生犯错，温和地纠正并解释原因。
- 保持语音回答简洁，因为这是实时语音对话。
- 不要逐字读出长化学公式；改为描述分子的结构或名称。` + CONCEPT_IMAGE_DIRECTIVE,
  
  ru: `Вы - ОПЫТНЫЙ преподаватель на университетском уровне, который говорит ТОЛЬКО на русском языке и разбирается во всех академических дисциплинах.
Всегда отвечайте на русском языке, независимо от языка ввода пользователя.
Ваша цель - помочь студентам понять сложные концепции в любой области (математика, химия, физика, биология, информатика и т.д.).
- Отвечайте даже на вопросы, не связанные с химией, и адаптируйте объяснения под тему.
- Объясняйте концепции четко, при необходимости используя аналогии.
- Если студент допустит ошибку, мягко исправьте и объясните почему.
- Будьте лаконичны в устных ответах, так как это речевой диалог в реальном времени.` + CONCEPT_IMAGE_DIRECTIVE,
  
  hi: `आप एक विशेषज्ञ, धैर्यवान और प्रोत्साहक विश्वविद्यालय स्तर के ट्यूटर हैं जो केवल हिंदी में बात करते हैं और हर विषय में मार्गदर्शन कर सकते हैं।
उपयोगकर्ता के इनपुट भाषा की परवाह किए बिना हमेशा हिंदी में जवाब दें।
आपका लक्ष्य छात्रों को किसी भी विषय (गणित, रसायन, भौतिकी, जीवविज्ञान, कंप्यूटर विज्ञान आदि) की जटिल अवधारणाओं को समझने में मदद करना है।
- यदि प्रश्न रसायन से अलग हो तब भी उत्तर दें और समझाते समय उदाहरण विषय के अनुसार चुनें।
- अवधारणाओं को स्पष्ट रूप से समझाएं और जहां उपयुक्त हो वहां सादृश्य का उपयोग करें।` + CONCEPT_IMAGE_DIRECTIVE,
  
  ar: `أنت خبير وصبور ومشجع في تدريس جميع المواد الأكاديمية على مستوى جامعي وتتحدث بالعربية فقط.
تحدث دائماً باللغة العربية بغض النظر عن لغة إدخال المستخدم.
هدفك هو مساعدة الطلاب على فهم المفاهيم المعقدة في أي مجال (رياضيات، كيمياء، فيزياء، أحياء، حوسبة، أدب وغيرها).
- أجب عن الأسئلة حتى لو لم تكن مرتبطة بالكيمياء، وعدّل أمثلتك حسب الموضوع المطلوب.
- اشرح المفاهيم بوضوح واستخدم القياس عند الحاجة.
- إذا ارتكب الطالب خطأ، صححه برفق واشرح السبب.` + CONCEPT_IMAGE_DIRECTIVE
};

const getSystemInstruction = (language: SupportedLanguage, pdfContext?: string): string => {
  let baseInstruction = SYSTEM_INSTRUCTIONS[language] || SYSTEM_INSTRUCTIONS.en;
  
  // If PDF content is available, add it to the context
  if (pdfContext && pdfContext.trim().length > 0) {
    baseInstruction += `

UPLOADED DOCUMENT CONTEXT:
The student has uploaded a PDF document with the following content:
---START OF DOCUMENT---
${pdfContext.substring(0, 5000)}
---END OF DOCUMENT---

IMPORTANT: When discussing this document:
1. Reference specific sections, equations, or concepts FROM THIS DOCUMENT
2. Call 'highlight_pdf_section' with exact text from the document
3. Make your explanations directly relevant to what the student is asking about in relation to this PDF
4. If the student asks about the PDF, ONLY discuss content that is in the document above
5. Correct the student if they misunderstand something in the PDF`;
  }
  
  return baseInstruction;
};

const simulationTool: FunctionDeclaration = {
  name: 'update_simulation',
  description: 'Control a chemical kinetics simulation to visualize reaction rates, collision theory, and activation energy.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isActive: { 
        type: Type.BOOLEAN, 
        description: 'Set to true to show the simulation, false to hide it.' 
      },
      temperature: { 
        type: Type.NUMBER, 
        description: 'Temperature of the system (0-100). Higher means faster particle movement.' 
      },
      concentration: { 
        type: Type.NUMBER, 
        description: 'Concentration of reactants (0-100). Higher means more particles.' 
      },
      activationEnergy: { 
        type: Type.NUMBER, 
        description: 'Activation energy barrier (0-100). Higher means fewer effective collisions.' 
      }
    },
    required: ['isActive']
  }
};

const molecule3DTool: FunctionDeclaration = {
  name: 'display_molecule_3d',
  description: 'Display a 3D molecular structure visualization to help students understand molecular geometry and structure.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isActive: { 
        type: Type.BOOLEAN, 
        description: 'Set to true to show the 3D molecule viewer, false to hide it.' 
      },
      smiles: { 
        type: Type.STRING, 
        description: 'SMILES notation of the molecule to display.' 
      },
      name: { 
        type: Type.STRING, 
        description: 'Common name of the molecule.' 
      },
      iupacName: { 
        type: Type.STRING, 
        description: 'IUPAC name of the molecule.' 
      },
      structure: { 
        type: Type.STRING, 
        description: 'JSON structure of the molecule or other molecular data format.' 
      }
    },
    required: ['isActive']
  }
};

const pdfHighlightTool: FunctionDeclaration = {
  name: 'highlight_pdf_section',
  description: 'Highlight specific text or equations from the uploaded PDF document to help students focus on what is being explained.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isActive: { 
        type: Type.BOOLEAN, 
        description: 'Set to true to highlight text in the PDF.' 
      },
      text: { 
        type: Type.STRING, 
        description: 'The exact text from the PDF to highlight. Should be a portion of the PDF content being explained.' 
      },
      context: { 
        type: Type.STRING, 
        description: 'Optional explanation of why this text is being highlighted and what it means.' 
      },
      page: { 
        type: Type.NUMBER, 
        description: 'Optional page number if highlighting a specific page (1-indexed).' 
      }
    },
    required: ['isActive', 'text']
  }
};

const learningCanvasTool: FunctionDeclaration = {
  name: 'show_learning_canvas',
  description: 'CRITICAL: Display step-by-step explanations for ANY subject with visual formatting. Use this AUTOMATICALLY for EVERY student question to provide structured learning. Steps can include LaTeX equations (for math/science), plain text explanations (for humanities/history), code snippets descriptions (for programming), or any structured content. Always break down explanations into clear steps.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isActive: { 
        type: Type.BOOLEAN, 
        description: 'Set to true to show the learning canvas. ALWAYS set to true when explaining anything to provide visual step-by-step guidance.' 
      },
      title: { 
        type: Type.STRING, 
        description: 'Clear title of what is being explained. Examples: "Deriving the Quadratic Formula", "Photosynthesis Process", "Understanding Recursion", "French Revolution Timeline", "Protein Synthesis Steps"' 
      },
      topic: { 
        type: Type.STRING, 
        description: 'Topic area. Examples: "Mathematics", "Biology", "Computer Science", "History", "Chemistry", "Physics", "Literature", etc.' 
      },
      steps: {
        type: Type.ARRAY,
        description: 'Ordered list of derivation steps. Each step must include a concise title, a valid display-mode LaTeX string, and an optional natural-language explanation.',
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Short heading for the step (e.g., "Apply Taylor expansion")'
            },
            latex: {
              type: Type.STRING,
              description: 'Display-mode LaTeX for equations (math/science), or plain text description for non-mathematical content. Can be empty if step is purely textual.'
            },
            explanation: {
              type: Type.STRING,
              description: 'Optional plain-language explanation that accompanies the math.'
            }
          },
          required: ['title']
        }
      }
    },
    required: ['isActive', 'title', 'steps']
  }
};

const conceptImageTool: FunctionDeclaration = {
  name: 'generate_concept_image',
  description: 'Generate a single high-quality illustrative image for the concept currently being explained so it can be streamed on the learning canvas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: 'Subject or domain of the concept (e.g., “Physics”, “Biology”, “History”).'
      },
      concept: {
        type: Type.STRING,
        description: 'The precise concept or phenomenon that needs to be visualized.'
      },
      prompt: {
        type: Type.STRING,
        description: 'Rich textual description for the image generator including context, important elements, and desired narrative.'
      },
      style: {
        type: Type.STRING,
        description: 'Optional art direction or medium (digital painting, blueprint, scientific infographic, etc.).'
      },
      focus: {
        type: Type.STRING,
        description: 'Specific sub-elements or relationships the image should emphasize.'
      },
      mood: {
        type: Type.STRING,
        description: 'Optional mood or tone for the illustration (e.g., calm, energetic, futuristic).'
      },
      colorPalette: {
        type: Type.STRING,
        description: 'Optional color guidance to keep the image visually coherent.'
      },
      importantElements: {
        type: Type.STRING,
        description: 'Comma-separated list of critical items, labels, or annotations to include.'
      },
      medium: {
        type: Type.STRING,
        description: 'Optional medium or output format (e.g., infographic, watercolor, technical rendering).'
      }
    },
    required: ['concept', 'prompt']
  }
};

const canvasSnapshotTool: FunctionDeclaration = {
  name: 'analyze_canvas_drawing',
  description: 'Capture and analyze what is currently drawn on the whiteboard/canvas. Use this when the student asks "what is this?", "check my work", "does this look right?", or asks questions about their drawing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: 'The specific question or aspect to analyze about the drawing (e.g., "Is this benzene ring correct?", "What functional group is this?").'
      }
    },
    required: ['question']
  }
};

const canvasWriteTool: FunctionDeclaration = {
  name: 'write_on_canvas',
  description: 'Write solutions, worked steps, or additional examples directly on the shared student canvas when they request to see answers or examples there.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: 'The text to render on the canvas. Include the full answer or example content.'
      },
      heading: {
        type: Type.STRING,
        description: 'Optional short title to prepend before the text (e.g., "Solution" or "Similar Example").'
      }
    },
    required: ['text']
  }
};

const canvasMoleculeTool: FunctionDeclaration = {
  name: 'place_molecule_on_canvas',
  description: 'Insert a requested molecule, reagent, or compound directly onto the shared canvas so the student can see it visually.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Common or IUPAC name to label under the molecule.'
      },
      smiles: {
        type: Type.STRING,
        description: 'SMILES string for the molecule (preferred when known).'
      },
      cid: {
        type: Type.STRING,
        description: 'PubChem CID identifier. Provide either CID, SMILES, or a name.'
      },
      displayLabel: {
        type: Type.STRING,
        description: 'Short custom label to show beneath the molecule graphic.'
      },
      role: {
        type: Type.STRING,
        description: 'Optional role indicator (reactant, reagent, catalyst, product, etc.).'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional context sentence about why the molecule is being shown.'
      }
    }
  }
};

const canvasProteinTool: FunctionDeclaration = {
  name: 'place_protein_on_canvas',
  description: 'Place a protein (PDB or AlphaFold structure) on the canvas when the student wants to visualize it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entryId: {
        type: Type.STRING,
        description: 'PDB ID or AlphaFold accession (e.g., 1CRN, 6LU7, AF-Q5VSL9).'
      },
      title: {
        type: Type.STRING,
        description: 'Short title or protein name to display.'
      },
      description: {
        type: Type.STRING,
        description: 'Optional description or function summary.'
      },
      organism: {
        type: Type.STRING,
        description: 'Organism/source of the protein.'
      },
      method: {
        type: Type.STRING,
        description: 'Experimental method (e.g., X-RAY DIFFRACTION, AlphaFold).'
      },
      depositionDate: {
        type: Type.STRING,
        description: 'Deposition or release date, if relevant.'
      },
      displayName: {
        type: Type.STRING,
        description: 'Custom label to show on the canvas.'
      }
    },
    required: ['entryId']
  }
};

const canvasReactionTool: FunctionDeclaration = {
  name: 'place_reaction_on_canvas',
  description: 'Render a reaction scheme (using reaction SMILES) directly on the canvas whenever the student asks to “bring” or “show” a reaction there.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reactionSmiles: {
        type: Type.STRING,
        description: 'Reaction SMILES in the Reactants>Agents>Products format.'
      },
      title: {
        type: Type.STRING,
        description: 'Optional reaction title (e.g., Aldol Condensation).' 
      },
      description: {
        type: Type.STRING,
        description: 'Optional description or mechanism summary.'
      },
      includeSdf: {
        type: Type.BOOLEAN,
        description: 'Set true to request 3D structures for the participants when available.'
      }
    },
    required: ['reactionSmiles']
  }
};

const buildConceptImagePrompt = (args: ConceptImageToolArgs, contextualNote?: string): string => {
  const concept = args.concept?.trim() || args.topic?.trim() || 'the requested concept';
  const parts = [
    `Generate a single educational illustration that clearly explains ${concept}.`,
    args.topic ? `Subject area: ${args.topic}.` : '',
    args.prompt?.trim() || '',
    args.focus ? `Emphasize ${args.focus}.` : '',
    args.importantElements ? `Include: ${args.importantElements}.` : '',
    args.style ? `Visual style guidance: ${args.style}.` : '',
    args.medium ? `Render this as ${args.medium}.` : '',
    args.mood ? `Mood: ${args.mood}.` : '',
    args.colorPalette ? `Preferred color palette: ${args.colorPalette}.` : '',
    contextualNote || '',
    'Use clear academic labeling where it improves understanding.',
    QUALITY_NOTE
  ];

  return parts.filter(Boolean).join('\n');
};

const buildDisplayPrompt = (args: ConceptImageToolArgs): string => {
  if (args.prompt && args.prompt.trim().length > 0) {
    return args.prompt.trim();
  }
  const target = args.concept?.trim() || args.topic?.trim() || 'this concept';
  return `Illustrative snapshot for ${target}.`;
};

export const useGeminiLive = (apiKey: string, language: SupportedLanguage = 'en') => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptionMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language);
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('Zephyr');
  const [simulationState, setSimulationState] = useState<VisualizationState>({
    isActive: false,
    type: 'NONE',
    kineticsParams: { temperature: 50, concentration: 50, activationEnergy: 50 },
    molecule3DParams: {},
    learningCanvasParams: undefined
  });
  const [conceptImages, setConceptImages] = useState<ConceptImageRecord[]>([]);
  
  // PDF state
  const [pdfContent, setPdfContent] = useState<string>('');
  const [highlightedPDFText, setHighlightedPDFText] = useState<string>('');
  
  // Canvas context hook
  const requestCanvasSnapshotRef = useRef<(() => Promise<string | null>) | null>(null);
  const setRequestCanvasSnapshot = useCallback((handler: () => Promise<string | null>) => {
    requestCanvasSnapshotRef.current = handler;
  }, []);

  const setCanvasTextInsertionHandler = useCallback((handler: (text: string) => void) => {
    canvasTextInsertionHandlerRef.current = handler;
  }, []);

  const setCanvasMarkdownInsertionHandler = useCallback((handler: (payload: { text: string; heading?: string }) => void) => {
    canvasMarkdownInsertionHandlerRef.current = handler;
  }, []);

  const setCanvasMoleculeInsertionHandler = useCallback((handler: (payload: CanvasMoleculePlacementRequest) => Promise<boolean> | boolean) => {
    canvasMoleculeInsertionHandlerRef.current = handler;
  }, []);

  const setCanvasProteinInsertionHandler = useCallback((handler: (payload: CanvasProteinPlacementRequest) => Promise<boolean> | boolean) => {
    canvasProteinInsertionHandlerRef.current = handler;
  }, []);

  const setCanvasReactionInsertionHandler = useCallback((handler: (payload: CanvasReactionPlacementRequest) => Promise<boolean> | boolean) => {
    canvasReactionInsertionHandlerRef.current = handler;
  }, []);

  const setCanvasSurfaceActive = useCallback((isActive: boolean) => {
    canvasSurfaceActiveRef.current = isActive;
  }, []);

  const captureAndSendSnapshot = useCallback(async (message?: string) => {
    if (!requestCanvasSnapshotRef.current) {
      console.warn('No canvas snapshot handler registered');
      return;
    }
    
    try {
      const imageDataUrl = await requestCanvasSnapshotRef.current();
      if (!imageDataUrl) {
        console.error('Failed to capture canvas snapshot: Empty result');
        return;
      }

      if (!sessionPromiseRef.current) {
        console.warn('No active Gemini Live session; cannot share canvas');
        return;
      }
      
      const session = await sessionPromiseRef.current;
      if (!session) {
        console.warn('Gemini Live session not resolved; aborting canvas share');
        return;
      }

      const base64Data = imageDataUrl.split(',')[1];
      const userMessage = message || "I'm sharing my canvas drawing with you. Please analyze it.";

      console.log('Sending canvas snapshot to Gemini Live (bytes:', base64Data?.length || 0, ')');

      await session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
      await session.sendRealtimeInput({ text: userMessage });

      console.log('Canvas snapshot sent successfully');
    } catch (e) {
      console.error("Failed to capture/send snapshot", e);
    }
  }, []);

  const triggerAutoShareCanvas = useCallback((userText: string) => {
    if (!userText || !shouldAutoShareCanvas(userText)) {
      return;
    }

    const normalized = userText.trim();
    if (!normalized) {
      return;
    }

    const now = Date.now();
    if (
      normalized === lastAutoShareRef.current.text &&
      now - lastAutoShareRef.current.timestamp < 4000
    ) {
      return;
    }

    lastAutoShareRef.current = { text: normalized, timestamp: now };
    console.log('Auto-sharing canvas snapshot based on user request');
    void captureAndSendSnapshot(normalized);
  }, [captureAndSendSnapshot]);

  const scheduleCanvasWriteFromUser = useCallback((userText: string) => {
    if (!userText) {
      return;
    }
    const intent = detectCanvasWriteIntent(userText);
    if (!intent) {
      return;
    }
    pendingCanvasWriteRef.current = { reason: intent, requestedAt: Date.now() };
    console.log('Scheduled canvas text insertion for intent:', intent);
  }, []);

  const pushTextToCanvas = useCallback((text: string, heading?: string) => {
    const sanitized = text?.toString().replace(/\n{3,}/g, '\n\n').trim();
    if (!sanitized) {
      return false;
    }

    const clipped = sanitized.slice(0, MAX_CANVAS_TEXT_LENGTH);
    const trimmedHeading = heading?.trim();

    if (canvasMarkdownInsertionHandlerRef.current) {
      canvasMarkdownInsertionHandlerRef.current({ text: clipped, heading: trimmedHeading });
      return true;
    }

    if (!canvasTextInsertionHandlerRef.current) {
      console.warn('Canvas text handler not registered');
      return false;
    }

    const finalText = trimmedHeading ? `${trimmedHeading}\n\n${clipped}` : clipped;
    canvasTextInsertionHandlerRef.current(finalText);
    return true;
  }, []);

  const placeMoleculeOnCanvas = useCallback(async (payload: CanvasMoleculePlacementRequest) => {
    if (!canvasMoleculeInsertionHandlerRef.current) {
      throw new Error('Canvas molecule handler is not available right now.');
    }
    const success = await canvasMoleculeInsertionHandlerRef.current(payload);
    if (!success) {
      throw new Error('Unable to place that molecule on the canvas.');
    }
  }, []);

  const placeProteinOnCanvas = useCallback(async (payload: CanvasProteinPlacementRequest) => {
    if (!canvasProteinInsertionHandlerRef.current) {
      throw new Error('Canvas protein handler is not available right now.');
    }
    const success = await canvasProteinInsertionHandlerRef.current(payload);
    if (!success) {
      throw new Error('Unable to place that protein structure on the canvas.');
    }
  }, []);

  const placeReactionOnCanvas = useCallback(async (payload: CanvasReactionPlacementRequest) => {
    if (!canvasReactionInsertionHandlerRef.current) {
      throw new Error('Canvas reaction handler is not available right now.');
    }
    const success = await canvasReactionInsertionHandlerRef.current(payload);
    if (!success) {
      throw new Error('Unable to render that reaction on the canvas.');
    }
  }, []);

  // Audio Contexts and Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Analyser for visualization
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Session management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiInstanceRef = useRef<GoogleGenAI | null>(null);
  const currentImageRequestIdRef = useRef<string | null>(null);
  const canvasTextInsertionHandlerRef = useRef<((text: string) => void) | null>(null);
  const canvasMarkdownInsertionHandlerRef = useRef<((payload: { text: string; heading?: string }) => void) | null>(null);
  const canvasMoleculeInsertionHandlerRef = useRef<((payload: CanvasMoleculePlacementRequest) => Promise<boolean> | boolean) | null>(null);
  const canvasProteinInsertionHandlerRef = useRef<((payload: CanvasProteinPlacementRequest) => Promise<boolean> | boolean) | null>(null);
  const canvasReactionInsertionHandlerRef = useRef<((payload: CanvasReactionPlacementRequest) => Promise<boolean> | boolean) | null>(null);
  const pendingCanvasWriteRef = useRef<{ reason: 'answer' | 'example'; requestedAt: number } | null>(null);
  const lastAutoShareRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const canvasSurfaceActiveRef = useRef(false);
  const canvasWritePerformedThisTurnRef = useRef(false);
  
  // Current transcript text buffers
  const currentInputRef = useRef<string>('');
  const currentOutputRef = useRef<string>('');
  const currentUserIdRef = useRef<string | null>(null);
  const currentModelIdRef = useRef<string | null>(null);
  const learningCanvasUpdatedThisTurnRef = useRef<boolean>(false);

  const createFallbackLearningCanvas = useCallback((text: string): LearningCanvasParams | null => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return null;
    }

    const sentenceChunks = normalized
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .filter(chunk => chunk && chunk.trim().length > 0);

    if (sentenceChunks.length === 0) {
      return null;
    }

    const grouped: string[] = [];
    let buffer = '';
    sentenceChunks.forEach(sentence => {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (candidate.length > 220 && buffer) {
        grouped.push(buffer.trim());
        buffer = sentence;
      } else {
        buffer = candidate;
      }
    });
    if (buffer) {
      grouped.push(buffer.trim());
    }

    const steps: DerivationStep[] = grouped.map((chunk, index) => ({
      title: `Insight ${index + 1}`,
      explanation: chunk,
      latex: ''
    }));

    if (steps.length === 0) {
      return null;
    }

    const titleSource = sentenceChunks[0] ?? 'Learning Canvas';
    const title = titleSource.length > 100 ? `${titleSource.slice(0, 97)}...` : titleSource;

    return {
      title: title || 'Learning Canvas',
      topic: 'General',
      steps
    };
  }, []);

  const pushFallbackLearningCanvas = useCallback((text: string) => {
    const fallback = createFallbackLearningCanvas(text);
    if (!fallback) return;

    setSimulationState(prev => ({
      isActive: true,
      type: 'LEARNING_CANVAS',
      kineticsParams: prev.kineticsParams,
      molecule3DParams: prev.molecule3DParams,
      learningCanvasParams: {
        ...fallback,
        image: undefined
      }
    }));
  }, [createFallbackLearningCanvas]);

  const initializeConceptImage = useCallback((rawArgs: ConceptImageToolArgs) => {
    const sanitizedArgs: ConceptImageToolArgs = {
      ...rawArgs,
      topic: rawArgs.topic?.trim() || rawArgs.topic,
      concept: rawArgs.concept?.trim() || rawArgs.topic?.trim() || 'Learning concept',
      prompt: rawArgs.prompt?.trim() || rawArgs.prompt,
      style: rawArgs.style?.trim() || rawArgs.style,
      focus: rawArgs.focus?.trim() || rawArgs.focus,
      mood: rawArgs.mood?.trim() || rawArgs.mood,
      colorPalette: rawArgs.colorPalette?.trim() || rawArgs.colorPalette,
      importantElements: rawArgs.importantElements?.trim() || rawArgs.importantElements,
      medium: rawArgs.medium?.trim() || rawArgs.medium
    };

    const requestId = uuidv4();
    currentImageRequestIdRef.current = requestId;
    const displayPrompt = buildDisplayPrompt(sanitizedArgs);
    let resolvedTitle = sanitizedArgs.concept || 'Concept Visualization';
    let resolvedTopic = sanitizedArgs.topic || 'General';

    setSimulationState(prev => {
      const existingParams = prev.learningCanvasParams;
      const baseParams: LearningCanvasParams = existingParams
        ? {
            ...existingParams,
            steps: Array.isArray(existingParams.steps) ? existingParams.steps : []
          }
        : {
            title: sanitizedArgs.concept || 'Concept Visualization',
            steps: []
          };

      baseParams.title = existingParams?.title || baseParams.title || sanitizedArgs.concept || 'Concept Visualization';
      baseParams.topic = sanitizedArgs.topic || existingParams?.topic || 'General';
      resolvedTitle = baseParams.title;
      resolvedTopic = baseParams.topic;
      baseParams.image = {
        status: 'loading',
        prompt: displayPrompt,
        concept: sanitizedArgs.concept || baseParams.title,
        topic: baseParams.topic,
        style: sanitizedArgs.style,
        focus: sanitizedArgs.focus,
        mood: sanitizedArgs.mood,
        colorPalette: sanitizedArgs.colorPalette,
        medium: sanitizedArgs.medium,
        importantElements: sanitizedArgs.importantElements,
        requestId,
        updatedAt: Date.now()
      };

      return {
        ...prev,
        isActive: true,
        type: 'LEARNING_CANVAS',
        kineticsParams: prev.kineticsParams,
        molecule3DParams: prev.molecule3DParams,
        learningCanvasParams: baseParams
      };
    });

    setConceptImages(prev => {
      const nextRecord: ConceptImageRecord = {
        id: requestId,
        title: resolvedTitle || sanitizedArgs.concept || 'Concept Snapshot',
        createdAt: Date.now(),
        status: 'loading',
        prompt: displayPrompt,
        displayPrompt,
        concept: sanitizedArgs.concept || resolvedTitle,
        topic: resolvedTopic,
        sourceTopic: resolvedTopic,
        style: sanitizedArgs.style,
        focus: sanitizedArgs.focus,
        mood: sanitizedArgs.mood,
        colorPalette: sanitizedArgs.colorPalette,
        medium: sanitizedArgs.medium,
        importantElements: sanitizedArgs.importantElements,
        requestId,
        updatedAt: Date.now()
      };

      const filtered = prev.filter(image => image.id !== requestId);
      return [nextRecord, ...filtered].slice(0, 20);
    });

    return { requestId, sanitizedArgs, displayPrompt };
  }, []);

  const notifyModelAboutImage = useCallback((record: ConceptImageRecord) => {
    if (!sessionPromiseRef.current) {
      return;
    }

    sessionPromiseRef.current
      ?.then(session => {
        if (!session) return;
        const conceptLabel = record.concept || record.title || 'the current concept';
        const galleryNote = `A new visual reference titled "${conceptLabel}" is now visible in the student's concept gallery.`;
        const promptNote = record.prompt || record.displayPrompt || 'Use this image to reinforce the explanation.';
        const message = `${galleryNote}\nReference details: ${promptNote}\nUse this visual context when answering follow-up questions about ${record.sourceTopic || conceptLabel}.`;
        session.sendRealtimeInput({ text: message }).catch((err: any) => {
          console.error('Failed to share concept image context with model:', err);
        });
      })
      .catch((err: any) => {
        console.error('Session not available to share concept image context:', err);
      });
  }, []);

  const finalizeConceptImage = useCallback((requestId: string, payload: { success: boolean; url?: string; error?: string; args: ConceptImageToolArgs; displayPrompt: string; }) => {
    if (currentImageRequestIdRef.current && currentImageRequestIdRef.current !== requestId) {
      return;
    }

    setSimulationState(prev => {
      const existingParams = prev.learningCanvasParams;
      if (!existingParams) {
        return prev;
      }

      const nextParams: LearningCanvasParams = {
        ...existingParams,
        steps: Array.isArray(existingParams.steps) ? existingParams.steps : []
      };

      const nextImage: LearningCanvasImage = {
        ...(existingParams.image ?? {}),
        status: payload.success ? 'complete' : 'error',
        url: payload.success ? payload.url : undefined,
        message: payload.success ? undefined : (payload.error || 'Unable to generate the concept image.'),
        prompt: payload.displayPrompt || payload.args.prompt || existingParams.image?.prompt,
        concept: payload.args.concept || existingParams.image?.concept,
        topic: payload.args.topic || existingParams.image?.topic,
        style: payload.args.style || existingParams.image?.style,
        focus: payload.args.focus || existingParams.image?.focus,
        mood: payload.args.mood || existingParams.image?.mood,
        colorPalette: payload.args.colorPalette || existingParams.image?.colorPalette,
        medium: payload.args.medium || existingParams.image?.medium,
        importantElements: payload.args.importantElements || existingParams.image?.importantElements,
        requestId,
        updatedAt: Date.now()
      };

      if (payload.success) {
        nextImage.alt = `Concept illustration for ${nextImage.concept || 'the topic'}`;
      }

      nextParams.image = nextImage;

      return {
        ...prev,
        isActive: true,
        type: 'LEARNING_CANVAS',
        kineticsParams: prev.kineticsParams,
        molecule3DParams: prev.molecule3DParams,
        learningCanvasParams: nextParams
      };
    });

    if (currentImageRequestIdRef.current === requestId) {
      currentImageRequestIdRef.current = null;
    }

    let finalizedRecord: ConceptImageRecord | null = null;
    setConceptImages(prev => prev.map(record => {
      if (record.id !== requestId) {
        return record;
      }

      const nextRecord: ConceptImageRecord = {
        ...record,
        status: payload.success ? 'complete' : 'error',
        url: payload.success ? payload.url : undefined,
        message: payload.success ? undefined : (payload.error || 'Unable to generate the concept image.'),
        prompt: payload.displayPrompt || payload.args.prompt || record.prompt,
        concept: payload.args.concept || record.concept,
        topic: payload.args.topic || record.topic,
        style: payload.args.style || record.style,
        focus: payload.args.focus || record.focus,
        mood: payload.args.mood || record.mood,
        colorPalette: payload.args.colorPalette || record.colorPalette,
        medium: payload.args.medium || record.medium,
        importantElements: payload.args.importantElements || record.importantElements,
        updatedAt: Date.now()
      };

      finalizedRecord = nextRecord;
      return nextRecord;
    }));

    if (payload.success && finalizedRecord) {
      notifyModelAboutImage(finalizedRecord);
    }
  }, [notifyModelAboutImage]);

  const handleConceptImageToolCall = useCallback(async (args: ConceptImageToolArgs) => {
    const baseArgs = normalizeConceptArgs({
      ...args,
      prompt: args.prompt?.trim() || `Create an instructive visualization of ${args.concept || args.topic || 'the concept'}.`
    });
    const { args: contextualArgsAfterGuides, contextualNote } = applyContextualVisualGuides(baseArgs);

    const { requestId, sanitizedArgs, displayPrompt } = initializeConceptImage(contextualArgsAfterGuides);
    const aiClient = aiInstanceRef.current;

    if (!aiClient) {
      finalizeConceptImage(requestId, { success: false, error: 'Image generator not ready.', args: sanitizedArgs, displayPrompt });
      throw new Error('Image generator is not ready.');
    }

    const finalPrompt = buildConceptImagePrompt(sanitizedArgs, contextualNote);

    try {
      const response = await aiClient.models.generateContentStream({
        model: CONCEPT_IMAGE_MODEL,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { imageSize: CONCEPT_IMAGE_SIZE },
          tools: IMAGE_GENERATION_TOOLS
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: finalPrompt }]
          }
        ]
      });

      let imageDataUrl: string | null = null;
      const stream = response as AsyncIterable<any>;

      for await (const chunk of stream) {
        const parts = chunk?.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part?.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            imageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
        if (imageDataUrl) break;
      }

      if (!imageDataUrl) {
        throw new Error('The concept image data was not returned.');
      }

      finalizeConceptImage(requestId, { success: true, url: imageDataUrl, args: sanitizedArgs, displayPrompt });
      return 'Concept image generated successfully.';
    } catch (error: any) {
      finalizeConceptImage(requestId, { success: false, error: error?.message || 'Failed to generate the concept image.', args: sanitizedArgs, displayPrompt });
      throw error;
    }
  }, [finalizeConceptImage, initializeConceptImage]);

  const disconnect = useCallback(() => {
    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }

    // Stop playback sources
    sourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();

    // Close contexts
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }

    // Reset State
    setAnalyser(null);
    setConnectionState(ConnectionState.DISCONNECTED);
    setConceptImages([]);
    setIsListening(false);
    setIsSpeaking(false);
    
    // Close session
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try {
                if(session && typeof session.close === 'function') {
                    session.close();
                }
            } catch (e) {
                console.error("Error closing session", e);
            }
        }).catch(() => {
            // Ignore errors if session promise failed
        });
        sessionPromiseRef.current = null;
    }

      aiInstanceRef.current = null;
      currentImageRequestIdRef.current = null;
  }, []);

  // Send PDF content to AI when connection is established
  const sendPdfContextToAI = useCallback(async () => {
    if (!pdfContent || pdfContent.trim().length === 0) {
      console.log('No PDF content to send');
      return;
    }

    if (!sessionPromiseRef.current) {
      console.log('No active session to send PDF content');
      return;
    }

    try {
      const session = await sessionPromiseRef.current;
      if (session) {
        const pdfMessage = `I have received a PDF document. Here is the content you should reference when answering my questions:

---START OF DOCUMENT---
${pdfContent.substring(0, 8000)}
---END OF DOCUMENT---

Please remember: Only discuss topics that are actually in this PDF document. Do not make up or assume information that is not provided. If I ask about something not in the PDF, let me know it's not in the document.`;
        
        console.log('Sending PDF context to AI - content length:', pdfContent.length);
        
        session.sendRealtimeInput({
          text: pdfMessage
        });
      }
    } catch (error) {
      console.error('Error sending PDF context to AI:', error);
    }
  }, [pdfContent]);

  const connect = useCallback(async () => {
    if (!apiKey) {
      setError("API Key not available. Please wait for Firebase to load.");
      return;
    }

    // Ensure clean state before connecting
    disconnect();

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Analyser for visualizer (connected to output)
      const newAnalyser = audioContextRef.current.createAnalyser();
      newAnalyser.fftSize = 512;
      newAnalyser.smoothingTimeConstant = 0.8;
      setAnalyser(newAnalyser);

      // Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });
      aiInstanceRef.current = ai;
      
      // Create Session
      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
          },
          systemInstruction: getSystemInstruction(selectedLanguage, pdfContent),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [simulationTool, molecule3DTool, learningCanvasTool, pdfHighlightTool, conceptImageTool, canvasSnapshotTool, canvasWriteTool, canvasMoleculeTool, canvasProteinTool, canvasReactionTool] }]
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Send PDF context if available
            if (pdfContent && pdfContent.trim().length > 0) {
              setTimeout(() => {
                sendPdfContextToAI();
              }, 100);
            }

            // Send initial greeting prompt
            setTimeout(() => {
              sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({
                  text: "The user has just connected. Please greet them warmly and ask 'How can I help you today?'"
                });
              });
            }, 500);
            
            // Start Audio Input Streaming
            if (!inputContextRef.current || !streamRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            inputSourceRef.current = source;
            
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              sessionPromiseRef.current?.then((session) => {
                try {
                   session.sendRealtimeInput({ media: pcmBlob });
                } catch (e) {
                   console.error("Error sending audio data:", e);
                }
              }).catch(err => {
                 // Session might have been closed or failed
                 console.debug("Session not ready for input:", err);
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
            setIsListening(true);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Tool Calls
             if (message.toolCall) {
                sessionPromiseRef.current?.then(async session => {
                  const functionCalls = message.toolCall!.functionCalls || [];
                  const functionResponses = await Promise.all(functionCalls.map(async fc => {
                    if (fc.name === 'update_simulation') {
                      const { isActive, temperature, concentration, activationEnergy } = fc.args as any;
                      
                      setSimulationState(prev => ({
                        isActive: isActive,
                        type: isActive ? 'KINETICS' : 'NONE',
                        kineticsParams: {
                          temperature: temperature ?? prev.kineticsParams?.temperature ?? 50,
                          concentration: concentration ?? prev.kineticsParams?.concentration ?? 50,
                          activationEnergy: activationEnergy ?? prev.kineticsParams?.activationEnergy ?? 50
                        },
                        molecule3DParams: prev.molecule3DParams,
                        learningCanvasParams: prev.learningCanvasParams
                      }));

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Simulation updated successfully' }
                      };
                    } else if (fc.name === 'display_molecule_3d') {
                      const { isActive, smiles, name, iupacName, structure } = fc.args as any;
                      
                      setSimulationState(prev => ({
                        isActive: isActive,
                        type: isActive ? 'MOLECULE_3D' : 'NONE',
                        kineticsParams: prev.kineticsParams,
                        molecule3DParams: {
                          smiles,
                          name,
                          iupacName,
                          structure
                        },
                        learningCanvasParams: prev.learningCanvasParams
                      }));

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Molecule display updated successfully' }
                      };
                    } else if (fc.name === 'show_learning_canvas') {
                      const { isActive, title, topic, steps } = fc.args as any;
                      
                      console.log('Learning Canvas Called:', { isActive, title, topic, steps });
                      
                      // Parse steps if it's a string (JSON)
                      let parsedSteps = steps;
                      if (typeof steps === 'string') {
                        try {
                          parsedSteps = JSON.parse(steps);
                        } catch (e) {
                          console.error('Error parsing steps JSON:', e, 'Raw steps:', steps);
                          parsedSteps = [];
                        }
                      }

                      // Validate that parsedSteps is an array
                      if (!Array.isArray(parsedSteps)) {
                        console.warn('Steps is not an array, converting:', parsedSteps);
                        parsedSteps = [parsedSteps];
                      }

                      console.log('Parsed steps:', parsedSteps);

                      setSimulationState(prev => {
                        const previousImage = prev.learningCanvasParams?.image;
                        const shouldCarryImage = Boolean(
                          previousImage && (
                            previousImage.status === 'loading' ||
                            previousImage.topic === (topic || prev.learningCanvasParams?.topic)
                          )
                        );

                        return {
                          isActive: isActive,
                          type: isActive ? 'LEARNING_CANVAS' : 'NONE',
                          kineticsParams: prev.kineticsParams,
                          molecule3DParams: prev.molecule3DParams,
                          learningCanvasParams: {
                            title: title || 'Learning Explanation',
                            topic: topic || 'General',
                            steps: Array.isArray(parsedSteps) ? parsedSteps : [],
                            image: shouldCarryImage ? previousImage : undefined
                          }
                        };
                      });

                      learningCanvasUpdatedThisTurnRef.current = true;
                      console.log('Learning canvas state updated');

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Learning canvas displayed successfully with step-by-step explanation' }
                      };
                    } else if (fc.name === 'generate_concept_image') {
                      try {
                        const resultMessage = await handleConceptImageToolCall(fc.args as ConceptImageToolArgs);
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: resultMessage }
                        };
                      } catch (error: any) {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: error?.message || 'Concept image generation failed.' }
                        };
                      }
                    } else if (fc.name === 'highlight_pdf_section') {
                      const { isActive, text, context, page } = fc.args as any;
                      
                      console.log('PDF Highlight Called:', { isActive, text, context, page });
                      
                      if (isActive && text) {
                        setHighlightedPDFText(text);
                      }

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: `PDF section highlighted: "${text.substring(0, 50)}..."` }
                      };
                    } else if (fc.name === 'analyze_canvas_drawing') {
                      const { question } = fc.args as any;
                      
                      try {
                        if (!requestCanvasSnapshotRef.current) {
                          throw new Error('Canvas snapshot capability not available.');
                        }
                        
                        const imageDataUrl = await requestCanvasSnapshotRef.current();
                        if (!imageDataUrl) {
                          throw new Error('Failed to capture canvas image.');
                        }
                        
                        console.log('Tool: analyze_canvas_drawing - Image captured, length:', imageDataUrl.length);

                        // Send the image as a user message with context
                        // Note: We send this as a separate input to ensure the model processes the image
                        // The tool response just confirms we did it.
                        setTimeout(() => {
                          const base64Data = imageDataUrl.split(',')[1];
                          const textPrompt = `Here is the snapshot of my canvas drawing. ${question || 'Please analyze it.'}`;
                          console.log('Tool: Sending image to Live API...');
                          session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } })
                            .then(() => session.sendRealtimeInput({ text: textPrompt }))
                            .catch(err => console.error('Failed to send canvas snapshot via tool call', err));
                        }, 200);

                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: 'Canvas snapshot captured and sent. Please analyze the image I just sent.' }
                        };
                      } catch (err: any) {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: err.message || 'Failed to analyze canvas.' }
                        };
                      }
                    } else if (fc.name === 'write_on_canvas') {
                      const { text, heading } = fc.args as any;
                      if (!text || typeof text !== 'string') {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: 'Text content is required to write on the canvas.' }
                        };
                      }

                      const inserted = pushTextToCanvas(text, heading || undefined);
                      pendingCanvasWriteRef.current = null;

                      if (inserted) {
                        canvasWritePerformedThisTurnRef.current = true;
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: 'Content written on the canvas successfully.' }
                        };
                      }

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { error: 'Canvas writing is unavailable right now.' }
                      };
                    } else if (fc.name === 'place_molecule_on_canvas') {
                      try {
                        await placeMoleculeOnCanvas(fc.args as CanvasMoleculeToolArgs);
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: 'Molecule placed on the canvas.' }
                        };
                      } catch (error: any) {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: error?.message || 'Failed to place molecule on the canvas.' }
                        };
                      }
                    } else if (fc.name === 'place_protein_on_canvas') {
                      try {
                        await placeProteinOnCanvas(fc.args as CanvasProteinToolArgs);
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: 'Protein placed on the canvas.' }
                        };
                      } catch (error: any) {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: error?.message || 'Failed to place protein on the canvas.' }
                        };
                      }
                    } else if (fc.name === 'place_reaction_on_canvas') {
                      try {
                        await placeReactionOnCanvas(fc.args as CanvasReactionToolArgs);
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { result: 'Reaction rendered on the canvas.' }
                        };
                      } catch (error: any) {
                        return {
                          id: fc.id,
                          name: fc.name,
                          response: { error: error?.message || 'Failed to render reaction on the canvas.' }
                        };
                      }
                    }
                    return {
                      id: fc.id,
                      name: fc.name,
                      response: { result: 'Unknown function' }
                    };
                  }));
                  
                  session.sendToolResponse({ functionResponses });
                });
             }

             // Handle Transcription
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                  if (!currentModelIdRef.current) {
                    learningCanvasUpdatedThisTurnRef.current = false;
                  }
                  currentOutputRef.current += text;
                
                setTranscripts(prev => {
                    const id = currentModelIdRef.current || uuidv4();
                    currentModelIdRef.current = id;
                    
                    const existing = prev.find(m => m.id === id);
                    if (existing) {
                        return prev.map(m => m.id === id ? { ...m, text: currentOutputRef.current } : m);
                    } else {
                        return [...prev, {
                            id,
                            text: currentOutputRef.current,
                            sender: 'model',
                            timestamp: new Date(),
                            isComplete: false
                        }];
                    }
                });
             } else if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentInputRef.current += text;

                setTranscripts(prev => {
                    const id = currentUserIdRef.current || uuidv4();
                    currentUserIdRef.current = id;
                    
                    const existing = prev.find(m => m.id === id);
                    if (existing) {
                        return prev.map(m => m.id === id ? { ...m, text: currentInputRef.current } : m);
                    } else {
                        return [...prev, {
                            id,
                            text: currentInputRef.current,
                            sender: 'user',
                            timestamp: new Date(),
                            isComplete: false
                        }];
                    }
                });
             }

             if (message.serverContent?.turnComplete) {
                // Mark current messages as complete
                if (currentUserIdRef.current) {
                    const id = currentUserIdRef.current;
                    const userTurnText = currentInputRef.current;
                    setTranscripts(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m));
                    if (userTurnText) {
                      triggerAutoShareCanvas(userTurnText);
                      scheduleCanvasWriteFromUser(userTurnText);
                    }
                    currentUserIdRef.current = null;
                }
                if (currentModelIdRef.current) {
                  const id = currentModelIdRef.current;
                  const completedText = currentOutputRef.current;
                  setTranscripts(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m));
                  currentModelIdRef.current = null;
                  currentOutputRef.current = '';

                  if (!learningCanvasUpdatedThisTurnRef.current && completedText.trim().length > 0) {
                    pushFallbackLearningCanvas(completedText);
                    learningCanvasUpdatedThisTurnRef.current = true;
                  }

                  learningCanvasUpdatedThisTurnRef.current = false;

                  const trimmedResponse = completedText.trim();
                  const pendingWrite = pendingCanvasWriteRef.current;
                  if (pendingWrite && trimmedResponse.length > 0) {
                    const heading = pendingWrite.reason === 'answer' ? 'Solution' : 'Similar Example';
                    const inserted = pushTextToCanvas(trimmedResponse, heading);
                    if (inserted) {
                      canvasWritePerformedThisTurnRef.current = true;
                    } else {
                      console.warn('Failed to push assistant response to canvas despite user request');
                    }
                    pendingCanvasWriteRef.current = null;
                  } else if (
                    trimmedResponse.length > 0 &&
                    canvasSurfaceActiveRef.current &&
                    !canvasWritePerformedThisTurnRef.current
                  ) {
                    const inserted = pushTextToCanvas(trimmedResponse, DEFAULT_AUTO_CANVAS_HEADING);
                    if (inserted) {
                      canvasWritePerformedThisTurnRef.current = true;
                    } else {
                      console.warn('Failed to push assistant response to canvas by default');
                    }
                  }
                }

                currentInputRef.current = '';
                currentOutputRef.current = '';
                canvasWritePerformedThisTurnRef.current = false;
             }

             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                try {
                    const audioBuffer = await decodeAudioData(
                        decode(base64Audio),
                        ctx,
                        24000,
                        1
                    );
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    // Connect to analyser and destination
                    if (newAnalyser) {
                        source.connect(newAnalyser);
                        newAnalyser.connect(ctx.destination);
                    } else {
                        source.connect(ctx.destination);
                    }

                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) {
                        setIsSpeaking(false);
                      }
                    });
                    
                    source.start(nextStartTimeRef.current);
                    sourcesRef.current.add(source);
                    setIsSpeaking(true);
                    
                    nextStartTimeRef.current += audioBuffer.duration;
                } catch (err) {
                    console.error("Error decoding audio chunk", err);
                }
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(source => source.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
               currentOutputRef.current = ''; 
               setIsSpeaking(false);
             }
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
            setError("Connection error. Please try again.");
            setConnectionState(ConnectionState.ERROR);
            disconnect();
          },
          onclose: () => {
            console.log("Session closed");
            setConnectionState(ConnectionState.DISCONNECTED);
            disconnect();
          }
        }
      });

    } catch (err: any) {
      disconnect(); // Clean up any partial resources
      setError(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
    }
  }, [disconnect, apiKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle language changes - reconnect if already connected
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      disconnect();
      // Auto-reconnect with new language after a brief delay
      const reconnectTimer = setTimeout(() => {
        connect();
      }, 500);
      return () => clearTimeout(reconnectTimer);
    }
  }, [selectedLanguage]);

  // Handle voice changes - reconnect if already connected
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      disconnect();
      // Auto-reconnect with new voice after a brief delay
      const reconnectTimer = setTimeout(() => {
        connect();
      }, 500);
      return () => clearTimeout(reconnectTimer);
    }
  }, [selectedVoice]);

  // Send PDF content when it changes and session is connected
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED && pdfContent && pdfContent.trim().length > 0) {
      // Inline the PDF sending logic to avoid circular dependencies
      sessionPromiseRef.current?.then(session => {
        if (session) {
          const pdfMessage = `I have received a PDF document. Here is the content you should reference when answering my questions:

---START OF DOCUMENT---
${pdfContent.substring(0, 8000)}
---END OF DOCUMENT---

Please remember: Only discuss topics that are actually in this PDF document. Do not make up or assume information that is not provided. If I ask about something not in the PDF, let me know it's not in the document.`;
          
          console.log('Sending PDF context to AI via effect - content length:', pdfContent.length);
          
          session.sendRealtimeInput({ text: pdfMessage }).catch((error: any) => {
            console.error('Error sending PDF content to AI:', error);
          });
        }
      }).catch(error => {
        console.error('Session not available for PDF context:', error);
      });
    }
  }, [pdfContent, connectionState]);

  return {
    connect,
    disconnect,
    connectionState,
    transcripts,
    analyser,
    simulationState,
    conceptImages,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedVoice,
    setSelectedVoice,
    pdfContent,
    setPdfContent,
    highlightedPDFText,
    setHighlightedPDFText,
    setRequestCanvasSnapshot,
    setCanvasTextInsertionHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasSurfaceActive,
    captureAndSendSnapshot,
    isListening,
    isSpeaking
  };
};