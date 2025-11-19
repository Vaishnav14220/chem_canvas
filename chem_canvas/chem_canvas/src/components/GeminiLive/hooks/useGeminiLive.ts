import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionState, TranscriptionMessage, SimulationState, SupportedLanguage, VoiceType, VisualizationState, MathematicalDerivationParams } from '../types';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Language-specific system instructions
const SYSTEM_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  en: `You are an expert, patient, and encouraging university-level Chemistry Tutor speaking ONLY in English.
Always respond in English regardless of the user's input language.
Your goal is to help students understand complex concepts in Organic, Inorganic, Physical, and Analytical Chemistry.

CORE TEACHING STYLE:
- Explain concepts clearly using analogies where appropriate.
- If a student makes a mistake, gently correct them and explain why.
- Be concise in your spoken responses, as this is a real-time voice conversation.
- Do not read out long chemical formulas character by character; describe the structure or name instead.
- Maintain a professional but approachable academic tone.

CRITICAL: IF A PDF DOCUMENT IS PROVIDED IN THE CONTEXT BELOW:
- You MUST refer to and explain the content from that specific PDF document
- When the student asks about "the PDF" or "the document", ONLY discuss what is actually in the provided content
- Reference specific equations, paragraphs, and concepts from the PDF
- Use 'highlight_pdf_section' to highlight the exact text you are explaining
- Do NOT make up or add information that is not in the provided document
- If something is not mentioned in the PDF, say so explicitly

INTERACTIVE VISUALIZATION TOOLS - USE THESE FREQUENTLY TO ENHANCE LEARNING:
1. 'update_simulation' - For reaction kinetics, collision theory, activation energy, equilibrium demonstration
   Parameters: temperature (0-100), concentration (0-100), activationEnergy (0-100)
   When to use: "Let me show you kinetics simulation", "Watch how temperature affects reaction rates"
   
2. 'display_molecule_3d' - For molecular structures, geometry, bonds, spatial arrangements
   Parameters: SMILES notation, molecule name, IUPAC name
   When to use: "Let me show you the structure", "Here's the 3D visualization of benzene"
   
3. 'show_math_derivation' - MOST IMPORTANT: Use this for ALL mathematical content, derivations, and problem-solving
   When to use THIS tool: ANY time the student asks about steps, derivations, or calculations
   Provide step-by-step solutions with LaTeX equations.

4. 'highlight_pdf_section' - REQUIRED when a PDF document is provided
   When to use: Whenever you reference or explain a specific part of the PDF
   Extract and pass the exact text from the PDF that you are discussing
   This helps students visually track what you're explaining in the document
   
MANDATORY: Whenever a student asks "how", "show me", "steps", "derive", or wants to see calculations:
- IMMEDIATELY call 'show_math_derivation' with clear step-by-step LaTeX equations
- Include explanations for each step
- Examples: equilibrium Kc calculations, pH problems, stoichiometry, kinetics equations, thermodynamics

PDF HIGHLIGHTING: When referencing a PDF document during explanation:
- Use 'highlight_pdf_section' to highlight the exact text being explained
- This helps students follow along visually with your audio explanation
- Always extract the exact text from the PDF for accurate highlighting

DO NOT skip the visualization tools. Use them proactively and frequently.`,
  
  es: `Eres un tutor EXPERTO de Química universitaria que habla SOLO en español.
Responde siempre en español sin importar el idioma de entrada del usuario.
Tu objetivo es ayudar a los estudiantes a comprender conceptos complejos en Química Orgánica, Inorgánica, Física y Analítica.
- Explica los conceptos claramente utilizando analogías cuando sea apropiado.
- Si un estudiante comete un error, corrige gentilmente y explica por qué.
- Sé conciso en tus respuestas habladas, ya que es una conversación de voz en tiempo real.
- No deletrees fórmulas químicas largas; describe la estructura o nombre de la molécula.
- Mantén un tono académico profesional pero accesible.`,
  
  fr: `Vous êtes un tuteur EXPERT en chimie au niveau universitaire qui parle UNIQUEMENT en français.
Répondez toujours en français, peu importe la langue d'entrée de l'utilisateur.
Votre objectif est d'aider les étudiants à comprendre des concepts complexes en Chimie Organique, Inorganique, Physique et Analytique.
- Expliquez les concepts clairement en utilisant des analogies le cas échéant.
- Si un étudiant fait une erreur, corrigez-le gentiment et expliquez pourquoi.
- Soyez concis dans vos réponses parlées, car c'est une conversation vocale en temps réel.
- Ne lisez pas les formules chimiques longues caractère par caractère; décrivez la structure ou le nom de la molécule.
- Maintenez un ton académique professionnel mais accessible.`,
  
  de: `Du bist ein EXPERTE Chemie-Tutor auf Universitätsniveau, der NUR auf Deutsch spricht.
Antworte immer auf Deutsch, unabhängig von der Eingabesprache des Benutzers.
Dein Ziel ist es, Schülern zu helfen, komplexe Konzepte in Organischer, Anorganischer, Physikalischer und Analytischer Chemie zu verstehen.
- Erkläre Konzepte klar und verwende wenn möglich Analogien.
- Wenn ein Schüler einen Fehler macht, korrigiere ihn sanft und erkläre warum.
- Sei prägnant in deinen gesprochenen Antworten, da dies ein Echtzeit-Sprachgespräch ist.
- Lies lange chemische Formeln nicht buchstabenweise vor; beschreibe stattdessen die Molekülstruktur oder den Namen.`,
  
  it: `Sei un tutor ESPERTO di Chimica a livello universitario che parla SOLO in italiano.
Rispondi sempre in italiano indipendentemente dalla lingua di input dell'utente.
Il tuo obiettivo è aiutare gli studenti a comprendere concetti complessi in Chimica Organica, Inorganica, Fisica e Analitica.
- Spiega i concetti chiaramente usando analogie quando appropriato.
- Se uno studente commette un errore, correggilo gentilmente e spiega il perché.
- Sii conciso nelle tue risposte parlate, poiché questa è una conversazione vocale in tempo reale.
- Non leggere lunghe formule chimiche carattere per carattere; descrivi la struttura o il nome della molecola.`,
  
  pt: `Você é um tutor ESPECIALISTA de Química em nível universitário que fala APENAS em português.
Sempre responda em português, independentemente do idioma de entrada do usuário.
Seu objetivo é ajudar os alunos a entender conceitos complexos em Química Orgânica, Inorgânica, Física e Analítica.
- Explique conceitos claramente usando analogias quando apropriado.
- Se um aluno cometer um erro, corrija gentilmente e explique o porquê.
- Seja conciso em suas respostas faladas, pois esta é uma conversa de voz em tempo real.
- Não leia fórmulas químicas longas caractere por caractere; descreva a estrutura ou o nome da molécula.`,
  
  ja: `あなたは日本語のみで話す大学レベルの化学の専門家で励ましの多いチューターです。
ユーザーの入力言語に関係なく、常に日本語で応答してください。
学生が有機化学、無機化学、物理化学、分析化学の複雑な概念を理解するのを支援することが目標です。
- 必要に応じて類推を使用して、概念を明確に説明します。
- 学生が間違いを犯した場合は、優しく訂正し、なぜそうなのかを説明します。
- リアルタイム音声会話なので、音声応答は簡潔にしてください。`,
  
  zh: `你是一位ONLY讲中文的大学级化学专家，耐心且鼓励学生的导师。
无论用户输入何种语言，总是用中文回应。
你的目标是帮助学生理解有机化学、无机化学、物理化学和分析化学的复杂概念。
- 清晰地解释概念，适当使用类比。
- 如果学生犯错，温和地纠正并解释原因。
- 保持语音回答简洁，因为这是实时语音对话。
- 不要逐字读出长化学公式；改为描述分子的结构或名称。`,
  
  ru: `Вы - ОПЫТНЫЙ преподаватель химии на университетском уровне, который говорит ТОЛЬКО на русском языке.
Всегда отвечайте на русском языке, независимо от языка ввода пользователя.
Ваша цель - помочь студентам понять сложные концепции органической, неорганической, физической и аналитической химии.
- Объясняйте концепции четко, при необходимости используя аналогии.
- Если студент допустит ошибку, мягко исправьте и объясните почему.
- Будьте лаконичны в устных ответах, так как это речевой диалог в реальном времени.`,
  
  hi: `आप एक विशेषज्ञ, धैर्यवान और प्रोत्साहक हिंदी केवल में बोलने वाले विश्वविद्यालय स्तर के रसायन विज्ञान के ट्यूटर हैं।
उपयोगकर्ता के इनपुट भाषा की परवाह किए बिना हमेशा हिंदी में जवाब दें।
आपका लक्ष्य छात्रों को कार्बनिक, अकार्बनिक, भौतिक और विश्लेषणात्मक रसायन विज्ञान की जटिल अवधारणाओं को समझने में मदद करना है।
- अवधारणाओं को स्पष्ट रूप से समझाएं और जहां उपयुक्त हो वहां सादृश्य का उपयोग करें।`,
  
  ar: `أنت خبير وصبور ومشجع في تدريس الكيمياء على مستوى جامعي تتحدث بـ العربية فقط.
تحدث دائماً باللغة العربية بغض النظر عن لغة إدخال المستخدم.
هدفك هو مساعدة الطلاب على فهم المفاهيم المعقدة في الكيمياء العضوية واللاعضوية والفيزيائية والتحليلية.
- اشرح المفاهيم بوضوح واستخدم القياس عند الحاجة.
- إذا ارتكب الطالب خطأ، صححه برفق واشرح السبب.`
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

const mathDerivationTool: FunctionDeclaration = {
  name: 'show_math_derivation',
  description: 'CRITICAL: Display step-by-step mathematical derivations or problem-solving with beautiful LaTeX equations. Use this for ALL math/calculations. The steps array MUST contain objects with: title, latex, and explanation fields. Format steps as a JSON array string.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isActive: { 
        type: Type.BOOLEAN, 
        description: 'Set to true to show the mathematical derivation viewer. ALWAYS set to true when explaining any math.' 
      },
      title: { 
        type: Type.STRING, 
        description: 'Clear title of what is being derived/solved. Examples: "Equilibrium Constant Kc", "pH Calculation from Ka", "Stoichiometry Problem", "Kinetics Rate Law"' 
      },
      topic: { 
        type: Type.STRING, 
        description: 'Topic area. Examples: "Chemical Equilibrium", "Acid-Base Chemistry", "Reaction Kinetics", "Thermodynamics"' 
      },
      steps: { 
        type: Type.OBJECT,
        description: 'ARRAY of step objects, each with: {title: string, latex: string (MUST be valid LaTeX), explanation: string}. MUST format steps as JSON array string. Each LaTeX equation should be complete and displayable. Example step: {"title": "Write equilibrium expression", "latex": "K_c = \\\\frac{[C]^2[D]}{[A][B]^2}", "explanation": "Products over reactants with stoichiometric coefficients"}' 
      }
    },
    required: ['isActive', 'title', 'steps']
  }
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
    molecule3DParams: {}
  });
  
  // PDF state
  const [pdfContent, setPdfContent] = useState<string>('');
  const [highlightedPDFText, setHighlightedPDFText] = useState<string>('');
  
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

  // Session management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Current transcript text buffers
  const currentInputRef = useRef<string>('');
  const currentOutputRef = useRef<string>('');
  const currentUserIdRef = useRef<string | null>(null);
  const currentModelIdRef = useRef<string | null>(null);

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
          tools: [{ functionDeclarations: [simulationTool, molecule3DTool, mathDerivationTool, pdfHighlightTool] }]
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
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Tool Calls
             if (message.toolCall) {
                sessionPromiseRef.current?.then(session => {
                  const functionResponses = message.toolCall!.functionCalls.map(fc => {
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
                        mathDerivationParams: prev.mathDerivationParams
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
                        mathDerivationParams: prev.mathDerivationParams
                      }));

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Molecule display updated successfully' }
                      };
                    } else if (fc.name === 'show_math_derivation') {
                      const { isActive, title, topic, steps } = fc.args as any;
                      
                      console.log('Math Derivation Called:', { isActive, title, topic, steps });
                      
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

                      setSimulationState(prev => ({
                        isActive: isActive,
                        type: isActive ? 'MATH_DERIVATION' : 'NONE',
                        kineticsParams: prev.kineticsParams,
                        molecule3DParams: prev.molecule3DParams,
                        mathDerivationParams: {
                          title: title || 'Mathematical Derivation',
                          topic: topic || 'Mathematics',
                          steps: parsedSteps || []
                        }
                      }));

                      console.log('Math derivation state updated');

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Mathematical derivation displayed successfully' }
                      };
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
                    }
                    return {
                      id: fc.id,
                      name: fc.name,
                      response: { result: 'Unknown function' }
                    };
                  });
                  
                  session.sendToolResponse({ functionResponses });
                });
             }

             // Handle Transcription
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
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
                    setTranscripts(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m));
                    currentUserIdRef.current = null;
                }
                if (currentModelIdRef.current) {
                    const id = currentModelIdRef.current;
                    setTranscripts(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m));
                    currentModelIdRef.current = null;
                }

                currentInputRef.current = '';
                currentOutputRef.current = '';
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
                    });
                    
                    source.start(nextStartTimeRef.current);
                    sourcesRef.current.add(source);
                    
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
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedVoice,
    setSelectedVoice,
    pdfContent,
    setPdfContent,
    highlightedPDFText,
    setHighlightedPDFText
  };
};