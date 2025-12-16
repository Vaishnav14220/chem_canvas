'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CopyIcon, RefreshCcwIcon, GlobeIcon, Bot, User, Send, StopCircle, CornerDownLeft, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import * as geminiService from '../services/geminiService';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { Loader } from './ai-elements/loader';
import { Reasoning } from './ai-elements/reasoning';
import { ChainOfThought } from './ai-elements/chain-of-thought';
import { InlineCitation } from './ai-elements/inline-citation';
import { Context } from './ai-elements/context';
import { cn } from '../lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';

const RESPONSE_STYLE_PROMPT = `You are an advanced academic AI assistant. You can help with any subject, including Chemistry, Mathematics, Physics, and Coding.
Rules:
- Answer ALL questions regardless of the subject.
- ALWAYS use properly formatted Markdown.
- Render ALL mathematical expressions using LaTeX:
  * Inline math: $...$ (e.g., $E = mc^2$, $x^2 + y^2 = z^2$)
  * Display math: $$...$$ for centered equations
- For Coding questions, provide clear explanations and code blocks.
- Start with a direct answer or brief overview.
- Use headings and bullet points for readability.`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{
    type: 'text' | 'reasoning' | 'source-url' | 'chain-of-thought';
    text?: string;
    url?: string;
    thought?: string;
    stepIndex?: number;
  }>;
}

interface AIElementsChatProps {
  onRequireApiKey?: () => void;
  onRequestVideoSearch?: (query: string) => void;
  showHeader?: boolean;
}

// Styled Components for Vercel/Shadcn Look

const Conversation: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('flex flex-col h-full text-zinc-50 font-sans', className)} style={{ backgroundColor: '#171717' }}>{children}</div>
);

const ConversationContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-8" style={{ backgroundColor: '#212121' }}>{children}</div>
);

const Message: React.FC<{ from: 'user' | 'assistant'; children: React.ReactNode; className?: string }> = ({ from, children, className }) => (
  <div className={cn('flex w-full', from === 'user' ? 'justify-end' : 'justify-start', className)}>
    <div className={cn('flex max-w-[90%] md:max-w-[85%] items-start gap-3', from === 'user' ? 'flex-row-reverse' : 'flex-row')}>

      {from === 'assistant' && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-zinc-800 text-zinc-400">
            <Bot className="h-4 w-4" />
          </div>
        </div>
      )}

      <div className={cn('relative min-w-0', from === 'user' ? 'bg-zinc-800 text-zinc-50 px-4 py-2.5 rounded-3xl rounded-tr-sm' : '')}>
        {children}
      </div>

    </div>
  </div>
);

const MessageActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">{children}</div>
);

const MessageAction: React.FC<{ onClick: () => void; label: string; children: React.ReactNode }> = ({ onClick, label, children }) => (
  <button
    onClick={onClick}
    className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
    title={label}
  >
    {children}
  </button>
);

const LocalPromptInput: React.FC<{ onSubmit: (message: { text: string }) => void; className?: string; children: React.ReactNode }> = ({ onSubmit, className, children }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const textarea = form.querySelector('textarea');
    if (textarea?.value.trim()) {
      onSubmit({ text: textarea.value });
      textarea.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('border-t border-border p-4', className)} style={{ backgroundColor: '#171717' }}>
      {children}
    </form>
  );
};

const LocalPromptInputBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative flex items-center gap-2 p-2 rounded-2xl border border-zinc-800 focus-within:ring-1 focus-within:ring-zinc-700 transition-all" style={{ backgroundColor: '#212121' }}>{children}</div>
);

const LocalPromptInputTextarea: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder || 'Send a message...'}
    className="flex-1 min-h-[40px] max-h-[200px] px-2 py-2 bg-transparent border-none text-sm text-zinc-100 resize-none focus:outline-none placeholder:text-zinc-500 scrollbar-thin scrollbar-thumb-zinc-700"
    rows={1}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
      }
    }}
  />
);

const LocalPromptInputSubmit: React.FC<{ disabled?: boolean; status?: string }> = ({ disabled, status }) => (
  <button
    type="submit"
    disabled={disabled || status === 'streaming'}
    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
  >
    {status === 'streaming' ? <Loader className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
  </button>
);

// Enhanced CodeBlock Component with Syntax Highlighting
const CodeBlock = ({ className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Resolve language extension
  const getExtension = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'js':
      case 'javascript':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'typescript':
        return [javascript({ jsx: true, typescript: true })];
      case 'py':
      case 'python':
        return [python()];
      case 'java':
        return [java()];
      case 'cpp':
      case 'c++':
      case 'c':
        return [cpp()];
      default:
        return [];
    }
  };

  return (
    <div className="my-6 rounded-lg border border-zinc-800 bg-[#1e1e1e] overflow-hidden group/code shadow-lg">
      <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 opacity-70 group-hover/code:opacity-100 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider font-mono">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md opacity-0 group-hover/code:opacity-100 transition-all hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
          title="Copy code"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
          <span className="text-[10px] font-medium">{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="text-[13px] leading-relaxed">
        <CodeMirror
          value={codeString}
          theme={vscodeDark}
          extensions={getExtension(language)}
          editable={false}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            bracketMatching: true,
            indentOnInput: false,
          }}
          className="[&_.cm-editor]:bg-[#1e1e1e] [&_.cm-scroller]:overflow-auto [&_.cm-content]:font-mono"
        />
      </div>
    </div>
  );
};

const AIElementsChat: React.FC<AIElementsChatProps> = ({
  onRequireApiKey,
  onRequestVideoSearch,
  showHeader = true,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memoize plugins to prevent re-parsing on every render
  const remarkPlugins = React.useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = React.useMemo(() => [[rehypeKatex, { strict: false, throwOnError: false, output: 'html' }]] as any, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  const handleSubmit = async (message: { text: string }) => {
    if (!message.text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: message.text }],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setStatus('submitted');

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      parts: [],
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setStatus('streaming');

    try {
      const apiKey = await getSharedGeminiApiKey();
      if (!apiKey) {
        throw new Error('API key required');
      }

      // Build conversation history
      const conversationHistory = messages
        .map((msg) => {
          const textParts = msg.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.text || '')
            .join(' ')
            .trim();
          if (!textParts) return null;
          return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${textParts}`;
        })
        .filter(Boolean)
        .join('\n\n');

      const fullPrompt = conversationHistory
        ? `${RESPONSE_STYLE_PROMPT}\n\nConversation history:\n${conversationHistory}\n\nUser question: ${message.text}`
        : `${RESPONSE_STYLE_PROMPT}\n\nUser question: ${message.text}`;

      let accumulatedText = '';
      let reasoningText = '';
      let chainOfThoughtSteps: string[] = [];
      const thinkingStartTime = Date.now();

      // Stream response with enhanced thinking support
      await geminiService.streamTextContent(
        fullPrompt,
        (chunk: string) => {
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    parts: [
                      ...(reasoningText ? [{ type: 'reasoning' as const, text: reasoningText }] : []),
                      ...(chainOfThoughtSteps.length > 0 ? chainOfThoughtSteps.map((step, idx) => ({ 
                        type: 'chain-of-thought' as const, 
                        text: step,
                        stepIndex: idx 
                      })) : []),
                      { type: 'text' as const, text: accumulatedText },
                    ],
                  }
                : msg
            )
          );
        },
        {
          model: 'gemini-2.5-pro',
          thinking: true, // Enable thinking with thinkingBudget for Gemini 2.5
          onThought: (thought: string) => {
            reasoningText += thought;
            
            // Parse chain of thought steps (if thought contains step markers)
            const stepMatches = thought.match(/Step \d+:|Step \d+\.|•|→/g);
            if (stepMatches && stepMatches.length > chainOfThoughtSteps.length) {
              // Extract new step
              const newStep = thought.split(stepMatches[stepMatches.length - 1])[1]?.trim();
              if (newStep) {
                chainOfThoughtSteps = [...chainOfThoughtSteps, newStep];
              }
            }
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      parts: [
                        { type: 'reasoning' as const, text: reasoningText },
                        ...(chainOfThoughtSteps.map((step, idx) => ({ 
                          type: 'chain-of-thought' as const, 
                          text: step,
                          stepIndex: idx 
                        }))),
                        ...(msg.parts.filter((p) => p.type === 'text')),
                      ],
                    }
                  : msg
              )
            );
          },
        }
      );

      // Finalize message with all thinking data
      const thinkingDuration = Math.floor((Date.now() - thinkingStartTime) / 1000);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                parts: [
                  ...(reasoningText ? [{ type: 'reasoning' as const, text: reasoningText }] : []),
                  ...(chainOfThoughtSteps.map((step, idx) => ({ 
                    type: 'chain-of-thought' as const, 
                    text: step,
                    stepIndex: idx 
                  }))),
                  { type: 'text' as const, text: accumulatedText },
                ],
              }
            : msg
        )
      );
      
      // Log thinking stats
      if (reasoningText) {
        console.log(`🧠 Thinking completed in ${thinkingDuration}s with ${reasoningText.length} characters of reasoning`);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error?.message || 'Failed to generate response';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
              ...msg,
              parts: [
                {
                  type: 'text',
                  text: `❌ Error: ${errorMessage}`,
                },
              ],
            }
            : msg
        )
      );

      if (errorMessage.includes('API key') || errorMessage.includes('key')) {
        onRequireApiKey?.();
      }
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="flex flex-col h-full font-sans" style={{ backgroundColor: '#171717' }}>
      {showHeader && (
        <div className="h-14 border-b border-border flex items-center px-4 justify-between sticky top-0 z-10" style={{ backgroundColor: '#171717' }}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-100">AI Chat</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Gemini 2.5 Pro</span>
          </div>
          <Context tokens={messages.reduce((acc, m) => acc + (m.parts[0]?.text?.length || 0) / 4, 0)} maxTokens={1000000} />
        </div>
      )}
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 p-8">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-zinc-200 font-medium mb-1">How can I help you?</h3>
              <p className="text-sm text-zinc-500 max-w-xs">I can help you analyze chemical reactions, interpret NMR spectra, or explain concepts.</p>
            </div>
          )}

          {messages.map((message) => {
            const sources = message.parts.filter((p) => p.type === 'source-url');
            const reasoningPart = message.parts.find((p) => p.type === 'reasoning');
            const chainOfThoughtParts = message.parts.filter((p) => p.type === 'chain-of-thought');
            const textParts = message.parts.filter((p) => p.type === 'text');
            const isLastMessage = message.id === messages[messages.length - 1]?.id;

            return (
              <div key={message.id} className="group">
                <Message from={message.role}>
                  {/* Display Reasoning/Thinking */}
                  {message.role === 'assistant' && reasoningPart && reasoningPart.text && (
                    <div className="mb-3 w-full">
                      <Reasoning 
                        isStreaming={status === 'streaming' && isLastMessage} 
                        className="w-full"
                      >
                        {reasoningPart.text}
                      </Reasoning>
                    </div>
                  )}

                  {/* Display Chain of Thought Steps */}
                  {message.role === 'assistant' && chainOfThoughtParts.length > 0 && (
                    <div className="mb-3 w-full space-y-2">
                      {chainOfThoughtParts.map((cotPart, idx) => (
                        <ChainOfThought
                          key={`cot-${message.id}-${idx}`}
                          isStreaming={status === 'streaming' && isLastMessage && idx === chainOfThoughtParts.length - 1}
                          defaultOpen={true}
                          className="w-full"
                        >
                          {cotPart.text || ''}
                        </ChainOfThought>
                      ))}
                    </div>
                  )}

                  {/* Display Chain of Thought Steps */}
                  {message.role === 'assistant' && message.parts.filter(p => p.type === 'chain-of-thought').length > 0 && (
                    <div className="mb-3 w-full space-y-2">
                      {message.parts
                        .filter(p => p.type === 'chain-of-thought')
                        .map((cotPart, idx) => (
                          <ChainOfThought
                            key={`cot-${message.id}-${idx}`}
                            isStreaming={status === 'streaming' && message.id === messages[messages.length - 1]?.id && idx === message.parts.filter(p => p.type === 'chain-of-thought').length - 1}
                            defaultOpen={true}
                            className="w-full"
                          >
                            {cotPart.text}
                          </ChainOfThought>
                        ))}
                    </div>
                  )}

                  {message.role === 'assistant' && sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 w-full">
                      {sources.map((source, i) => (
                        <InlineCitation key={i} title={`Source ${i + 1}`} url={source.url} description={source.url} />
                      ))}
                    </div>
                  )}

                  {textParts.length > 0 && (
                    <div className={cn(
                      "prose max-w-none prose-invert",
                      message.role === 'user' ? "text-zinc-50" : "text-zinc-100 [&_strong]:text-zinc-50",
                      // Custom Spacing and Typography Overrides
                      "[&_p]:leading-relaxed [&_p]:mb-6 last:[&_p]:mb-0",
                      "[&_h1]:mt-8 [&_h1]:mb-6 [&_h1]:font-semibold [&_h1]:text-white",
                      "[&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-white",
                      "[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-zinc-50",
                      "[&_ul]:my-6 [&_li]:mb-3 [&_li]:pl-0",
                      "[&_ol]:my-6 [&_li]:mb-3",
                      "[&_blockquote]:border-l-4 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400"
                    )}>
                      {textParts.map((part, i) => (
                        <ErrorBoundary key={i}>
                          <ReactMarkdown
                            remarkPlugins={remarkPlugins}
                            rehypePlugins={rehypePlugins}
                            components={{
                              a: ({ node, ...props }: any) => (
                                <a
                                  {...props}
                                  className="text-blue-400 hover:underline hover:text-blue-300 break-all"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              code: ({ inline, className, children, ...props }: any) => {
                                return !inline ? (
                                  <CodeBlock className={className} {...props}>
                                    {children}
                                  </CodeBlock>
                                ) : (
                                  <code
                                    className="bg-zinc-800/50 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-200"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },

                              // Style blockquotes
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-zinc-700 pl-4 py-1 italic text-zinc-400">
                                  {children}
                                </blockquote>
                              ),
                              // Style tables
                              table: ({ children }) => (
                                <div className="my-4 w-full overflow-y-auto">
                                  <table className="w-full text-sm text-left">{children}</table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="border-b border-zinc-700 py-2 px-3 font-medium text-zinc-200">{children}</th>
                              ),
                              td: ({ children }) => (
                                <td className="border-b border-zinc-800 py-2 px-3 text-zinc-300">{children}</td>
                              )
                            }}
                          >
                            {part.text || ''}
                          </ReactMarkdown>
                        </ErrorBoundary>
                      ))}
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <MessageActions>
                      {onRequestVideoSearch && (
                        <MessageAction
                          onClick={() => onRequestVideoSearch(textParts.map(p => p.text).join(' '))}
                          label="Find on YouTube"
                        >
                          <GlobeIcon className="h-3 w-3" />
                        </MessageAction>
                      )}
                      <MessageAction
                        onClick={() => navigator.clipboard.writeText(textParts.map(p => p.text).join('\n'))}
                        label="Copy"
                      >
                        <CopyIcon className="h-3 w-3" />
                      </MessageAction>
                      <MessageAction
                        onClick={() => {
                          const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
                          if (lastUserMessage) {
                            setMessages((prev) => prev.filter((m) => m.id !== message.id));
                            setInput(lastUserMessage.parts.find((p) => p.type === 'text')?.text || '');
                            setTimeout(() => handleSubmit({ text: lastUserMessage.parts.find((p) => p.type === 'text')?.text || '' }), 100);
                          }
                        }}
                        label="Regenerate"
                      >
                        <RefreshCcwIcon className="h-3 w-3" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              </div>
            );
          })}

          {status === 'submitted' && <div className="flex justify-start pl-9 py-2"><Loader className="animate-spin text-zinc-600 h-4 w-4" /></div>}

          <div ref={messagesEndRef} className="h-px" />
        </ConversationContent>
      </Conversation>

      <LocalPromptInput onSubmit={handleSubmit}>
        <LocalPromptInputBody>
          <LocalPromptInputTextarea value={input} onChange={(e) => setInput(e.target.value)} />
          <LocalPromptInputSubmit disabled={!input.trim()} status={status} />
        </LocalPromptInputBody>
        <div className="text-center mt-2">
          <span className="text-[10px] text-zinc-600">ChemAssist can make mistakes. Verify important info.</span>
        </div>
      </LocalPromptInput>
    </div>
  );
};

export default AIElementsChat;
