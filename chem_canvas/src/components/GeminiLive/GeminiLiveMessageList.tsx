import React, { useRef, useEffect, useCallback } from 'react';
import { Bot, Sparkles, User } from 'lucide-react';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai/conversation';
import { cn } from '@/lib/utils';
import type { TranscriptionMessage } from './types';

interface GeminiLiveMessageListProps {
  transcripts: TranscriptionMessage[];
}

const GeminiLiveMessageList: React.FC<GeminiLiveMessageListProps> = ({ transcripts }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when transcripts change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [transcripts, scrollToBottom]);

  return (
    <Conversation
      className="relative flex h-full flex-col rounded-2xl border border-slate-800/70 bg-slate-950/60 shadow-inner"
      padding="md"
      tone="default"
      initial="instant"
      resize="smooth"
      aria-live="polite"
    >
      <ConversationContent className="flex-1 px-4 py-3 overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground/50">
             {/* Empty state removed */}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 pb-4">
              {transcripts.map(message => (
                <MessageBubble key={`${message.id}-${message.timestamp.getTime()}`} message={message} />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg" />
    </Conversation>
  );
};

interface MessageBubbleProps {
  message: TranscriptionMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const timestamp = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);

  return (
    <article
      className={cn('flex items-start gap-3 group', isUser && 'flex-row-reverse')}
      aria-label={`${isUser ? 'Learner' : 'Tutor'} message`}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground shadow-sm flex-shrink-0 mt-1',
          isUser && 'bg-primary/20 text-primary border-primary/30 shadow-primary/10'
        )}
      >
        {isUser ? <User size={16} aria-hidden /> : <Bot size={16} aria-hidden />}
        <span className="sr-only">{isUser ? 'Learner' : 'Tutor'}</span>
      </div>
      <div className={cn("flex flex-col gap-1 max-w-[85%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            'rounded-2xl border border-border/50 bg-background/70 px-4 py-3 leading-relaxed text-foreground shadow-sm backdrop-blur',
            isUser && 'bg-primary/20 text-slate-100 border-primary/30 shadow-lg shadow-primary/5 rounded-tr-sm',
            !isUser && 'bg-slate-950/40 border-slate-800/60 rounded-tl-sm'
          )}
        >
          <p className="whitespace-pre-line text-sm">{message.text}</p>
        </div>
        <time
          dateTime={timestamp.toISOString()}
          className={cn('block text-[10px] font-mono uppercase tracking-wide text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity px-1')}
        >
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </article>
  );
};

export default GeminiLiveMessageList;
