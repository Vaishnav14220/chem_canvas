import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionState, TranscriptionMessage, SimulationState, SupportedLanguage, VoiceType } from '../types';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Language-specific system instructions
const SYSTEM_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  en: `You are an expert, patient, and encouraging university-level Chemistry Tutor speaking ONLY in English.
Always respond in English regardless of the user's input language.
Your goal is to help students understand complex concepts in Organic, Inorganic, Physical, and Analytical Chemistry.
- Explain concepts clearly using analogies where appropriate.
- If a student makes a mistake, gently correct them and explain why.
- Be concise in your spoken responses, as this is a real-time voice conversation.
- Do not read out long chemical formulas character by character unless asked; describe the molecule's structure or name instead.
- Maintain a professional but approachable academic tone.
- You have access to an interactive simulation tool. Use 'update_simulation' when the user asks to see or change a simulation.`,
  
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

const getSystemInstruction = (language: SupportedLanguage): string => {
  return SYSTEM_INSTRUCTIONS[language] || SYSTEM_INSTRUCTIONS.en;
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

export const useGeminiLive = (apiKey: string, language: SupportedLanguage = 'en') => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptionMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language);
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('Zephyr');
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isActive: false,
    type: 'KINETICS',
    params: { temperature: 50, concentration: 50, activationEnergy: 50 }
  });
  
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
          systemInstruction: getSystemInstruction(selectedLanguage),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [simulationTool] }]
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
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
                        type: 'KINETICS',
                        params: {
                          temperature: temperature ?? prev.params.temperature,
                          concentration: concentration ?? prev.params.concentration,
                          activationEnergy: activationEnergy ?? prev.params.activationEnergy
                        }
                      }));

                      return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Simulation updated successfully' }
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
    setSelectedVoice
  };
};