import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Send, 
  Upload, 
  MessageSquare, 
  FileText, 
  Plus, 
  Trash2, 
  GripVertical,
  X,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import * as geminiService from '../services/geminiService';
import { generateStreamingContent, isGeminiStreamingInitialized } from '../services/geminiStreaming';
import 'katex/dist/katex.min.css';

interface UploadedDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

interface OutputSection {
  id: string;
  name: string;
  required: boolean;
  enabled: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onClose }) => {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputSections, setOutputSections] = useState<OutputSection[]>([
    { id: 'answer', name: 'Answer', required: true, enabled: true },
    { id: 'step-by-step', name: 'Step-by-Step', required: false, enabled: true },
    { id: 'extra-info', name: 'Extra Info', required: false, enabled: true },
    { id: 'citation', name: 'Citation', required: true, enabled: true },
  ]);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(isGeminiStreamingInitialized());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingQueueRef = useRef<string[]>([]);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setIsApiKeyConfigured(isGeminiStreamingInitialized());
  }, []);

  useEffect(() => {
    return () => {
      stopCharacterStreaming();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startCharacterStreaming = (messageId: string) => {
    streamingMessageIdRef.current = messageId;
    streamingIntervalRef.current = setInterval(() => {
      if (streamingQueueRef.current.length > 0) {
        const char = streamingQueueRef.current.shift()!;
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: msg.content + char }
            : msg
        ));
      } else if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
        streamingMessageIdRef.current = null;
      }
    }, 10); // 10ms delay between characters
  };

  const stopCharacterStreaming = () => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    streamingQueueRef.current = [];
    streamingMessageIdRef.current = null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const content = await file.text();
      const newDocument: UploadedDocument = {
        id: Date.now().toString(),
        name: file.name,
        content: content,
        size: file.size,
        type: file.type,
        uploadedAt: new Date()
      };
      
      setUploadedDocuments(prev => [...prev, newDocument]);
      
      // Auto-add a welcome message about the uploaded document
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `📄 Document "${file.name}" has been uploaded successfully! I can now help you analyze and discuss its content. What would you like to know about it?`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, welcomeMessage]);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const reorderSections = (draggedId: string, targetId: string | null) => {
    setOutputSections((prev) => {
      const updated = [...prev];
      const draggedIndex = updated.findIndex((section) => section.id === draggedId);
      const targetIndex = targetId ? updated.findIndex((section) => section.id === targetId) : updated.length - 1;
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return prev;
      }
      const [draggedSection] = updated.splice(draggedIndex, 1);
      const insertionIndex =
        targetId && draggedIndex < targetIndex
          ? targetIndex - 1
          : targetIndex;
      updated.splice(insertionIndex, 0, draggedSection);
      return updated;
    });
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, sectionId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    setDraggingSectionId(sectionId);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string | null) => {
    event.preventDefault();
    if (draggingSectionId) {
      reorderSections(draggingSectionId, targetId);
    }
    setDraggingSectionId(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggingSectionId(null);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsGenerating(true);

    try {
      if (!isGeminiStreamingInitialized()) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '🔑 **API Key Required**\n\nTo use the chat assistant, please configure your Gemini API key first.\n\n1. Click the Settings button (⚙️) in the toolbar\n2. Enter your Google Gemini API key\n3. Save the configuration\n\nGet your free API key at: https://makersuite.google.com/app/apikey',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      // Build context from uploaded documents
      let contextPrompt = '';
      if (uploadedDocuments.length > 0) {
        contextPrompt = '**Document Context:**\n';
        uploadedDocuments.forEach(doc => {
          contextPrompt += `\n**Document: ${doc.name}**\n${doc.content.substring(0, 2000)}...\n`;
        });
        contextPrompt += '\n**User Question:** ';
      }

      // Build output format instructions
      const enabledSections = outputSections.filter(section => section.enabled);
      let formatInstructions = '\n\n**Please format your response with the following sections:**\n';
      enabledSections.forEach(section => {
        formatInstructions += `- **${section.name}**: `;
        switch (section.id) {
          case 'answer':
            formatInstructions += 'Provide a direct, clear answer to the question.\n';
            break;
          case 'step-by-step':
            formatInstructions += 'Break down complex processes or explanations into clear, numbered steps.\n';
            break;
          case 'extra-info':
            formatInstructions += 'Include additional relevant information, tips, or related concepts.\n';
            break;
          case 'citation':
            formatInstructions += 'Reference specific parts of the uploaded documents or provide source citations.\n';
            break;
          default:
            formatInstructions += 'Provide relevant information for this section.\n';
        }
      });

      const fullPrompt = contextPrompt + inputMessage + formatInstructions;

      // Create a placeholder message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Start character streaming
      startCharacterStreaming(assistantMessageId);

      // Use streaming for better user experience
      await generateStreamingContent(
        fullPrompt,
        (chunk: string) => {
          // Add chunk characters to the streaming queue
          streamingQueueRef.current.push(...chunk.split(''));
        },
        (fullResponse: string) => {
          // Final response received
          console.log('Streaming completed:', fullResponse);
          // Wait a bit for all characters to be displayed, then stop streaming
          setTimeout(() => {
            stopCharacterStreaming();
          }, 100);
        },
        (error: Error) => {
          // Handle error
          stopCharacterStreaming();
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: `❌ **Error**: ${error.message}\n\nPlease check your API key and try again.` }
              : msg
          ));
        }
      );
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Error**: ${error.message || 'Failed to generate response'}\n\nPlease check your API key and try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const addNewSection = () => {
    if (!newSectionName.trim()) return;
    
    const newSection: OutputSection = {
      id: newSectionName.toLowerCase().replace(/\s+/g, '-'),
      name: newSectionName.trim(),
      required: false,
      enabled: true
    };
    
    setOutputSections(prev => [...prev, newSection]);
    setNewSectionName('');
  };

  const removeSection = (sectionId: string) => {
    setOutputSections(prev => prev.filter(section => section.id !== sectionId));
  };

  const toggleSection = (sectionId: string) => {
    setOutputSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, enabled: !section.enabled } : section
    ));
  };

  const downloadChatHistory = () => {
    const chatHistory = messages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`
    ).join('\n\n');
    
    const blob = new Blob([chatHistory], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
    }
  };

  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant' && message.content.trim().length > 0) {
        return message;
      }
    }
    return null;
  }, [messages]);

  const markdownRemarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const markdownRehypePlugins = useMemo(() => [rehypeKatex], []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 bg-[#020816]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.25),transparent_55%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.18),transparent_60%),radial-gradient(circle_at_50%_90%,rgba(45,212,191,0.2),transparent_65%)]" />
      <div className="relative z-10 flex min-h-screen w-full flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex w-full flex-1 flex-col rounded-[32px] border border-white/10 bg-[#0b1221]/98 shadow-[0_40px_120px_-60px_rgba(2,12,33,0.9)] backdrop-blur">
          <header className="border-b border-white/10 px-6 pb-6 pt-8 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-[0_30px_50px_-35px_rgba(59,130,246,0.75)]">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white">AI Chat Assistant</h2>
                  <p className="text-sm text-blue-100/80">
                    {uploadedDocuments.length > 0
                      ? `${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? '' : 's'} ready for analysis`
                      : 'Upload documents to get started'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={downloadChatHistory}
                  disabled={messages.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  Export Chat
                </button>
                <button
                  onClick={clearChat}
                  disabled={messages.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white transition hover:bg-white hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>
          <div className="border-b border-white/10 px-6 py-4 lg:px-10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-white/15 cursor-pointer">
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading…' : 'Upload Document'}
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                  multiple
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {uploadedDocuments.length === 0 ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-blue-100/70">No documents uploaded yet</span>
                ) : (
                  uploadedDocuments.map((doc) => (
                    <span key={doc.id} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-blue-100/80">
                      <FileText className="h-3.5 w-3.5 text-blue-200" />
                      {doc.name}
                      <button
                        onClick={() => removeDocument(doc.id)}
                        className="rounded-full p-1 text-blue-200/70 transition hover:bg-blue-500/20 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden px-6 pb-8 pt-4 lg:px-10">
            <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
              <section className="flex h-full flex-col rounded-2xl border border-white/12 bg-white/6 p-6 text-white shadow-[0_35px_60px_-40px_rgba(15,23,42,0.6)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Conversation</h3>
                    <p className="text-xs text-blue-100/70">
                      {messages.length === 0
                        ? 'Ask anything about your uploaded documents.'
                        : `${messages.length} message${messages.length === 1 ? '' : 's'} in this session`}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex-1 overflow-hidden">
                  <div className="scrollbar-thin h-full space-y-4 overflow-y-auto pr-2">
                    {messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-md space-y-4 text-blue-100/80">
                          <MessageSquare className="mx-auto h-16 w-16 text-blue-300/70" />
                          <h3 className="text-xl font-semibold text-white">Ready when you are</h3>
                          <p className="text-sm">
                            Upload a file, then ask for key points, outlines, study questions, citations, or anything else you need.
                          </p>
                          {!isApiKeyConfigured && (
                            <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-200">
                              <strong>API Key Required:</strong> Configure your Gemini API key in Settings to start chatting.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                                : 'bg-white/10 border border-white/12 text-blue-100/90'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <div className="prose prose-invert prose-sm max-w-none text-blue-100/90 prose-headings:text-white prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:marker:text-blue-200">
                                <ReactMarkdown
                                  remarkPlugins={markdownRemarkPlugins}
                                  rehypePlugins={markdownRehypePlugins}
                                >
                                  {message.content || ''}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{message.content}</div>
                            )}
                            <div
                              className={`mt-2 text-2xs uppercase tracking-wide ${
                                message.role === 'user' ? 'text-white/70' : 'text-blue-100/60'
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {isGenerating && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-blue-100/80 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-blue-300/40 border-t-blue-300 rounded-full animate-spin" />
                            <span>AI is thinking…</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Ask a question about your uploaded documents..."
                        className="w-full min-h-[64px] max-h-[132px] resize-none rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:opacity-60"
                        disabled={isGenerating}
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || isGenerating}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.6)] transition hover:brightness-110 disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </section>
              <aside className="flex h-full flex-col gap-6">
                <div className="space-y-4 rounded-2xl border border-white/12 bg-white/6 p-5 text-white shadow-[0_30px_60px_-45px_rgba(15,23,42,0.6)] backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold">Output Layout</h4>
                      <p className="text-xs text-blue-100/70">Toggle or add sections to tailor Gemini’s responses.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addNewSection();
                        }
                      }}
                      placeholder="Add new section"
                      className="flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-blue-100/50 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    />
                    <button
                      onClick={addNewSection}
                      disabled={!newSectionName.trim()}
                      className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div
                    className="space-y-2"
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, null)}
                  >
                    {outputSections.map((section) => (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={(event) => handleDragStart(event, section.id)}
                        onDragOver={handleDragOver}
                        onDrop={(event) => handleDrop(event, section.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between rounded-lg border border-white/12 px-3 py-2 transition ${
                          section.enabled ? 'bg-white/10' : 'bg-white/5 opacity-70'
                        } ${draggingSectionId === section.id ? 'border-dashed opacity-80' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-blue-100/60" />
                          <button
                            onClick={() => toggleSection(section.id)}
                            className={`rounded-full border border-white/15 px-2 py-1 text-[11px] font-medium transition ${
                              section.enabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-blue-100/50'
                            }`}
                          >
                            {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <span className="text-sm">{section.name}</span>
                          {section.required && (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-100 uppercase tracking-wide">
                              Required
                            </span>
                          )}
                        </div>
                        {!section.required && (
                          <button
                            onClick={() => removeSection(section.id)}
                            className="rounded-full p-1 text-red-200 transition hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-2xs text-blue-100/60">Drag handles are visual only—sections will follow the order listed here.</p>
                </div>
                <div className="flex-1 rounded-2xl border border-white/12 bg-white/6 p-5 text-white shadow-[0_30px_60px_-45px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h4 className="text-lg font-semibold">Latest Response</h4>
                  <p className="text-xs text-blue-100/70 mb-3">
                    We surface the most recent assistant reply so you can copy or export without scrolling.
                  </p>
                  <div className="h-full overflow-y-auto rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm text-blue-100/85">
                    {latestAssistantMessage ? (
                      <div className="prose prose-invert prose-sm max-w-none text-blue-100/90 prose-headings:text-white prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:marker:text-blue-200">
                        <ReactMarkdown
                          remarkPlugins={markdownRemarkPlugins}
                          rehypePlugins={markdownRehypePlugins}
                        >
                          {latestAssistantMessage.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-blue-100/60">Send a prompt to see the structured output here.</div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
