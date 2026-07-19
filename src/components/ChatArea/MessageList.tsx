import type { Message as MessageType } from '../../types';
import { Message } from './Message';

interface Props {
  messages: MessageType[];
  isStreaming: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newText: string) => void;
}

export function MessageList({ messages, isStreaming, onRegenerate, onEdit }: Props) {
  const last = messages.length - 1;
  return (
    <>
      {messages.map((msg, i) => (
        <Message
          key={msg.id}
          message={msg}
          isStreaming={isStreaming && i === last && msg.role === 'assistant'}
          actionsDisabled={isStreaming}
          onRegenerate={i === last && msg.role === 'assistant' ? onRegenerate : undefined}
          onEdit={msg.role === 'user' ? onEdit : undefined}
        />
      ))}
    </>
  );
}
