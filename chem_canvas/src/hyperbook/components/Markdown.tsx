import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import { cn, truncateUrl } from '../lib/utils';
import type { Source } from '../lib/types';
import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

function CitationBubble(props: { index: number; source?: Pick<Source, 'title' | 'url' | 'text' | 'content'> }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const title = props.source?.title || props.source?.url || `Source ${props.index}`;
  const url = props.source?.url;
  const snippetRaw = props.source?.text || props.source?.content || '';
  const snippet = snippetRaw.replace(/\s+/g, ' ').trim().slice(0, 360);

  return (
    <span ref={rootRef} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
        aria-label={`Show citation ${props.index}`}
      >
        [{props.index}]
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold text-gray-600">Citation [{props.index}]</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close citation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 text-sm font-semibold text-black break-words">{title}</div>

          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-blue-600 hover:underline break-all"
            >
              {truncateUrl(url)}
            </a>
          ) : null}

          {snippet ? <div className="mt-2 text-xs text-gray-600 leading-relaxed">{snippet}...</div> : null}
        </div>
      ) : null}
    </span>
  );
}

function renderWithCitations(node: any, sources: Source[] | undefined, keyPrefix: string): any {
  if (!sources || sources.length === 0) return node;
  if (typeof node === 'string') {
    const parts = node.split(/(\[\d+\])/g);
    if (parts.length === 1) return node;
    return parts.map((part, idx) => {
      const match = /^\[(\d+)\]$/.exec(part);
      if (!match) return part;
      const n = Number(match[1]);
      const src = Number.isFinite(n) ? sources[n - 1] : undefined;
      return <CitationBubble key={`${keyPrefix}-cite-${idx}-${n}`} index={n} source={src} />;
    });
  }

  if (Array.isArray(node)) {
    return node.map((child, i) => renderWithCitations(child, sources, `${keyPrefix}-${i}`));
  }

  // Don't parse citations inside code blocks/inline code.
  if (isValidElement(node) && (node.type === 'code' || node.type === 'pre')) return node;

  if (isValidElement(node) && node.props?.children) {
    const children = renderWithCitations(node.props.children, sources, `${keyPrefix}-c`);
    return cloneElement(node, { ...node.props, children });
  }

  return node;
}

export function Markdown({
  content,
  className,
  sources,
}: {
  content: string;
  className?: string;
  sources?: Source[];
}) {
  const components = useMemo<Components>(() => {
    const wrap = (Tag: keyof JSX.IntrinsicElements) =>
      // eslint-disable-next-line react/display-name
      ({ node, children, ...props }: any) => {
        return (
          <Tag {...props}>
            {renderWithCitations(children, sources, `${String(Tag)}-${node?.position?.start?.offset ?? ''}`)}
          </Tag>
        );
      };

    return {
      p: wrap('p'),
      li: wrap('li'),
      h1: wrap('h1'),
      h2: wrap('h2'),
      h3: wrap('h3'),
      h4: wrap('h4'),
      h5: wrap('h5'),
      h6: wrap('h6'),
      blockquote: wrap('blockquote'),
    };
  }, [sources]);

  return (
    <div className={cn('prose prose-sm max-w-none text-inherit', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
