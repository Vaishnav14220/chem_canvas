import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { Message, Source } from '../lib/types';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ChatMessage } from './ChatMessage';

export function ChatInterface(props: {
  messages: Message[];
  streamingContent: string;
  isLoading: boolean;
  onSendMessage: (content: string) => void | Promise<void>;
  hasSource: boolean;
  sources?: Source[];
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages, props.streamingContent, props.isLoading]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold">Chat</h2>
        <p className="text-xs text-gray-500 mt-1">Ask questions about your sources</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!props.hasSource && props.messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-10">Add sources to begin chatting.</div>
          ) : null}

          {props.messages.map((m) => (
            <ChatMessage key={m.id} message={m} sources={props.sources} />
          ))}

          {props.streamingContent ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-gray-100 text-black">{props.streamingContent}</div>
            </div>
          ) : null}

          {props.isLoading ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-gray-100 text-black">Thinking...</div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            value={input}
            disabled={!props.hasSource || props.isLoading}
            placeholder={props.hasSource ? 'Ask a question...' : 'Add sources first...'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = input.trim();
                if (!v) return;
                void props.onSendMessage(v);
                setInput('');
              }
            }}
          />
          <Button
            size="icon"
            disabled={!props.hasSource || props.isLoading || !input.trim()}
            onClick={() => {
              const v = input.trim();
              if (!v) return;
              void props.onSendMessage(v);
              setInput('');
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
