import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionState, TranscriptionMessage, SimulationState } from '../types';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.0-flash-exp';

// System instruction for the tutor
const SYSTEM_INSTRUCTION = `You are an expert, patient, and encouraging university-level Chemistry Tutor. 
Your goal is to help students understand complex concepts in Organic, Inorganic, Physical, and Analytical Chemistry.
- Explain concepts clearly using analogies where appropriate.
- If a student makes a mistake, gently correct them and explain why.
- Be concise in your spoken responses, as this is a real-time voice conversation.
- Do not read out long chemical formulas character by character unless asked; describe the molecule's structure or name instead.
- Maintain a professional but approachable academic tone.
- You have access to an interactive simulation tool. Use 'update_simulation' when the user asks to see or change a simulation of kinetics, reaction rates, collision theory, or activation energy.
- When you update the simulation, verbally describe what you are changing (e.g., "I'm raising the temperature to show how particles move faster.").`;

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

export const useGeminiLive = (apiKey: string) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptionMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
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

  return {
    connect,
    disconnect,
    connectionState,
    transcripts,
    analyser,
    simulationState,
    error
  };
};