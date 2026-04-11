import { memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface Props {
  content: string;
}

function extractText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractText((children as { props: { children?: ReactNode } }).props.children);
  }
  return String(children ?? '');
}

function MarkdownRendererInner({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, node }) {
          const match = /language-(\w+)/.exec(className || '');
          // Detect block code: has a language tag, or is inside a <pre>
          const isBlock = match || node?.position?.start.line !== node?.position?.end.line;

          if (isBlock) {
            const raw = extractText(children).replace(/\n$/, '');
            return <CodeBlock language={match?.[1] || ''}>{raw}</CodeBlock>;
          }

          return <code className={className}>{children}</code>;
        },
        pre({ children }) {
          return <>{children}</>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);
