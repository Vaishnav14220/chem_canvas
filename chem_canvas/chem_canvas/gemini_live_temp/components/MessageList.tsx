import React, { useEffect, useRef } from 'react';
import { TranscriptionMessage } from '../types';
import { Bot, User, Sparkles } from 'lucide-react';

interface MessageListProps {
  transcripts: TranscriptionMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ transcripts }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
        <Sparkles className="w-12 h-12 mb-4 text-slate-700 opacity-50" />
        <p className="text-sm font-mono">Transcript will appear here...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {transcripts.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
            ${msg.sender === 'user' 
              ? 'bg-slate-700 text-slate-200' 
              : 'bg-molecule-purple text-white shadow-lg shadow-molecule-purple/30'}
          `}>
            {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          
          <div className={`
            max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${msg.sender === 'user' 
              ? 'bg-slate-800 text-slate-200 rounded-tr-sm' 
              : 'bg-slate-900/80 border border-slate-700 text-slate-100 rounded-tl-sm'}
          `}>
            <p>{msg.text}</p>
            <span className="text-[10px] opacity-40 mt-1 block font-mono">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;