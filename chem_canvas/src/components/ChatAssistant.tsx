import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Upload, 
  Settings, 
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
  const [showOutputFormatModal, setShowOutputFormatModal] = useState(false);
  const [outputSections, setOutputSections] = useState<OutputSection[]>([
    { id: 'answer', name: 'Answer', required: true, enabled: true },
    { id: 'step-by-step', name: 'Step-by-Step', required: false, enabled: true },
    { id: 'extra-info', name: 'Extra Info', required: false, enabled: true },
    { id: 'citation', name: 'Citation', required: true, enabled: true },
  ]);
  const [newSectionName, setNewSectionName] = useState('');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(isGeminiStreamingInitialized());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setIsApiKeyConfigured(isGeminiStreamingInitialized());
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

      // Use streaming for better user experience
      await generateStreamingContent(
        fullPrompt,
        (chunk: string) => {
          // Update the message with new chunk
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        },
        (fullResponse: string) => {
          // Final response received
          console.log('Streaming completed:', fullResponse);
        },
        (error: Error) => {
          // Handle error
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-lg w-[1000px] max-w-[95vw] h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Chat Assistant</h2>
              <p className="text-sm text-muted-foreground">
                {uploadedDocuments.length > 0 
                  ? `${uploadedDocuments.length} document(s) uploaded` 
                  : 'Upload documents to get started'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOutputFormatModal(true)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
              title="Customize Output Format"
            >
              <Settings className="h-4 w-4" />
              Format
            </button>
            
            <button
              onClick={downloadChatHistory}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
              title="Download Chat History"
            >
              <Download className="h-4 w-4" />
            </button>
            
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Document Upload Section */}
        <div className="px-6 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 gap-2 cursor-pointer">
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload Document'}
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              
              <div className="flex items-center gap-2">
                {uploadedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-1">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm">{doc.name}</span>
                    <button
                      onClick={() => removeDocument(doc.id)}
                      className="hover:bg-muted rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Chat
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Welcome to AI Chat Assistant</h3>
                <p className="text-muted-foreground mb-6">
                  Upload documents and ask questions to get AI-powered insights and analysis.
                </p>
                
                {!isApiKeyConfigured && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                    <p className="text-orange-700 dark:text-orange-400 text-sm">
                      <strong>API Key Required:</strong> Configure your Gemini API key in Settings to start chatting.
                    </p>
                  </div>
                )}
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>💡 <strong>Try asking:</strong></p>
                  <ul className="text-left space-y-1 ml-4">
                    <li>• "Summarize the main points"</li>
                    <li>• "Explain the key concepts"</li>
                    <li>• "What are the important formulas?"</li>
                    <li>• "Create study questions"</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted border border-border'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-2 opacity-70 ${
                    message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <span className="text-sm text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border">
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
                className="w-full min-h-[60px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isGenerating}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isGenerating}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Output Format Customization Modal */}
        {showOutputFormatModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60" onClick={() => setShowOutputFormatModal(false)}>
            <div className="bg-card border border-border rounded-lg shadow-xl w-[500px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Customize Output Format</h3>
                  <button
                    onClick={() => setShowOutputFormatModal(false)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <p className="text-sm text-muted-foreground mb-6">
                  Add, remove, or rearrange output sections to customize how Gemini's response is displayed.
                </p>
                
                {/* Add New Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Add New Section</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Enter section name"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addNewSection();
                        }
                      }}
                    />
                    <button
                      onClick={addNewSection}
                      className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-9"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Current Sections */}
                <div>
                  <label className="block text-sm font-medium mb-3">Current Sections</label>
                  <div className="space-y-2">
                    {outputSections.map((section) => (
                      <div key={section.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <div className="flex-1 flex items-center gap-2">
                          <button
                            onClick={() => toggleSection(section.id)}
                            className={`p-1 rounded ${
                              section.enabled 
                                ? 'text-primary' 
                                : 'text-muted-foreground'
                            }`}
                          >
                            {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <span className="text-sm">{section.name}</span>
                          {section.required && (
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        {!section.required && (
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-1 hover:bg-destructive/20 rounded text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-3">
                    Drag and drop to reorder sections. Required sections cannot be removed.
                  </p>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowOutputFormatModal(false)}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatAssistant;



