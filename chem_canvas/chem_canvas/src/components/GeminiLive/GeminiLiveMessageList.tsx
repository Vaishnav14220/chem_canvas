import React from 'react';
import { Bot, Sparkles, User } from 'lucide-react';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai/conversation';
import { cn } from '@/lib/utils';
import type { TranscriptionMessage } from './types';

interface GeminiLiveMessageListProps {
  transcripts: TranscriptionMessage[];
}

const GeminiLiveMessageList: React.FC<GeminiLiveMessageListProps> = ({ transcripts }) => {
  return (
    <Conversation
      className="relative flex h-full flex-col rounded-2xl border border-slate-800/70 bg-slate-950/60 shadow-inner"
      padding="md"
      tone="default"
      initial="smooth"
      resize="smooth"
      aria-live="polite"
    >
      <ConversationContent className="flex-1 px-4 py-3 overflow-y-auto">
        {transcripts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {transcripts.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
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
      className={cn('flex items-start gap-3 text-sm', isUser && 'flex-row-reverse text-right')}
      aria-label={`${isUser ? 'Learner' : 'Tutor'} message`}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground shadow-sm',
          isUser && 'bg-primary text-primary-foreground border-primary shadow-primary/30'
        )}
      >
        {isUser ? <User size={16} aria-hidden /> : <Bot size={16} aria-hidden />}
        <span className="sr-only">{isUser ? 'Learner' : 'Tutor'}</span>
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl border border-border/50 bg-background/70 px-4 py-3 leading-relaxed text-foreground shadow-sm backdrop-blur',
          isUser && 'bg-primary/30 text-white border-primary/60 shadow-lg shadow-primary/20'
        )}
      >
        <p className="whitespace-pre-line text-sm">{message.text}</p>
        <time
          dateTime={timestamp.toISOString()}
          className={cn('mt-2 block text-[10px] font-mono uppercase tracking-wide text-muted-foreground/70', isUser && 'text-white/70')}
        >
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </article>
  );
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-muted-foreground">
    <Sparkles className="h-10 w-10 text-primary" aria-hidden />
    <div>
      <p className="text-sm font-semibold">Conversation feed is idle</p>
      <p className="text-xs text-muted-foreground/80">Messages from the live tutor will stream here in real time.</p>
    </div>
  </div>
);

export default GeminiLiveMessageList;
