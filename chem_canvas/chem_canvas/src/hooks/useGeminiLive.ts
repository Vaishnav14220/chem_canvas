speechConfig: {
  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
},
systemInstruction: SYSTEM_INSTRUCTION,
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
    currentOutputRef.current += message.serverContent.outputTranscription.text;
  } else if (message.serverContent?.inputTranscription) {
    currentInputRef.current += message.serverContent.inputTranscription.text;
  }

  if (message.serverContent?.turnComplete) {
    const userText = currentInputRef.current;
    const modelText = currentOutputRef.current;

    if (userText.trim()) {
      setTranscripts(prev => [...prev, {
        id: uuidv4(),
        text: userText,
        sender: 'user',
        timestamp: new Date(),
        isComplete: true
      }]);
    }
    if (modelText.trim()) {
      setTranscripts(prev => [...prev, {
        id: uuidv4(),
        text: modelText,
        sender: 'model',
        timestamp: new Date(),
        isComplete: true
      }]);
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
  }, [disconnect]);

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