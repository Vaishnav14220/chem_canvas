import type { Message, Source } from '../lib/types';
import { Markdown } from './Markdown';

export function ChatMessage({ message, sources }: { message: Message; sources?: Source[] }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${isUser ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
        <Markdown content={message.content} sources={isUser ? undefined : sources} />
      </div>
    </div>
  );
}
