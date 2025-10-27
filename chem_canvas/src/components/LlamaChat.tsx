import { useCallback, useMemo, useState } from 'react';
import {
  ChatSection,
  type ChatHandler,
  type Message
} from '@llamaindex/chat-ui';

interface LlamaChatProps {
  onClose?: () => void;
}

const DEFAULT_MESSAGES: Message[] = [
  {
    id: 'intro',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'Welcome to the LlamaIndex Canvas Chat. Use this space to request study guides, molecule descriptions, or spectrum insights.'
      }
    ]
  }
];

const isTextPart = (part: Message['parts'][number]): part is Extract<Message['parts'][number], { type: 'text'; text: string }> => part.type === 'text';

const LlamaChatInner = () => {
  const [messages, setMessages] = useState<Message[]>(() => [...DEFAULT_MESSAGES]);
  const [status, setStatus] = useState<ChatHandler['status']>('ready');

  const handleSend = useCallback(async (message: Message) => {
    setMessages((prev) => [...prev, message]);
    setStatus('streaming');

    const userText = message.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join(' ')
      .trim();

    await new Promise((resolve) => setTimeout(resolve, 600));

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: userText
            ? `Here is where Gemini response would appear for: "${userText}"`
            : 'Here is where Gemini response would appear.'
        }
      ]
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setStatus('ready');
  }, []);

  const chatHandler = useMemo<ChatHandler>(() => ({
    messages,
    status,
    sendMessage: async (message) => {
      await handleSend(message);
    },
    setMessages: (updatedMessages) => {
      setMessages(updatedMessages);
    }
  }), [messages, status, handleSend]);

  return <ChatSection handler={chatHandler} className="flex h-full flex-col" />;
};

const LlamaChat: React.FC<LlamaChatProps> = ({ onClose }) => {
  return (
    <div className="h-full bg-slate-900 text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold">LlamaIndex Canvas Chat</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md"
          >
            Close
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <LlamaChatInner />
      </div>
    </div>
  );
};

export default LlamaChat;

