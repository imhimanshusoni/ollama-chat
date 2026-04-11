import type { Message as MessageType } from '../../types';
import { Message } from './Message';

interface Props {
  messages: MessageType[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: Props) {
  return (
    <>
      {messages.map((msg, i) => (
        <Message
          key={i}
          message={msg}
          isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
        />
      ))}
    </>
  );
}
