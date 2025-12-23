import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormattedMessageProps {
  content: string;
  onCitationClick?: () => void;
}

export default function FormattedMessage({ content, onCitationClick }: FormattedMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      let processedContent = content || '';

      // Process block math ($$...$$)
      processedContent = processedContent.replace(
        /\$\$([\s\S]*?)\$\$/g,
        (match, math) => {
          try {
            const html = katex.renderToString(math.trim(), {
              displayMode: true,
              throwOnError: false,
              trust: true,
            });
            return `<div class="math-block my-3">${html}</div>`;
          } catch (e) {
            console.warn('KaTeX block math error:', e);
            return match;
          }
        }
      );

      // Process inline math ($...$)
      processedContent = processedContent.replace(
        /\$([^\$\n]+?)\$/g,
        (match, math) => {
          try {
            const html = katex.renderToString(math.trim(), {
              displayMode: false,
              throwOnError: false,
              trust: true,
            });
            return `<span class="math-inline">${html}</span>`;
          } catch (e) {
            console.warn('KaTeX inline math error:', e);
            return match;
          }
        }
      );

    // Process chemical equations with arrow notation
    processedContent = processedContent.replace(
      /\b([A-Z][a-z]?\d*(?:\([a-z]+\))?(?:\s*\+\s*[A-Z][a-z]?\d*(?:\([a-z]+\))?)*)\s*(→|->|⟶)\s*([A-Z][a-z]?\d*(?:\([a-z]+\))?(?:\s*\+\s*[A-Z][a-z]?\d*(?:\([a-z]+\))?)*)/g,
      (match) => {
        return `<div class="chemical-equation my-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-purple-200 font-mono text-center">${match.replace(/->/g, '→').replace(/⟶/g, '→')}</div>`;
      }
    );

    // Process chemical formulas (like H2O, CO2, etc.) with subscripts
    processedContent = processedContent.replace(
      /\b([A-Z][a-z]?)(\d+)/g,
      '<span class="chemical-formula">$1<sub>$2</sub></span>'
    );

    // Process code blocks ```...```
    processedContent = processedContent.replace(
      /```([\s\S]*?)```/g,
      '<pre class="code-block bg-gray-800 text-gray-100 p-4 rounded-lg my-3 overflow-x-auto"><code>$1</code></pre>'
    );

    // Process inline code `...`
    processedContent = processedContent.replace(
      /`([^`]+)`/g,
      '<code class="inline-code bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-mono">$1</code>'
    );

    // Process bold **...**
    processedContent = processedContent.replace(
      /\*\*([^\*]+)\*\*/g,
      '<strong class="font-bold text-gray-900">$1</strong>'
    );

    // Process italic *...*
    processedContent = processedContent.replace(
      /\*([^\*]+)\*/g,
      '<em class="italic text-gray-800">$1</em>'
    );

    // Process bullet points
    processedContent = processedContent.replace(
      /^[\-\*]\s+(.+)$/gm,
      '<li class="ml-4 mb-1">• $1</li>'
    );

    // Wrap consecutive list items in ul
    processedContent = processedContent.replace(
      /(<li class="ml-4 mb-1">[\s\S]*?<\/li>\n*)+/g,
      '<ul class="my-2 space-y-1">$&</ul>'
    );

    // Process numbered lists
    processedContent = processedContent.replace(
      /^(\d+)\.\s+(.+)$/gm,
      '<li class="ml-4 mb-1"><span class="font-semibold text-purple-600">$1.</span> $2</li>'
    );

    // Process citations 📄 (Page X)
    processedContent = processedContent.replace(
      /📄\s*\(Page\s+(\d+)\)/gi,
      '<span class="citation-badge">📄 Page $1</span>'
    );

    // Process line breaks
    processedContent = processedContent.replace(/\n\n/g, '<br/><br/>');
    processedContent = processedContent.replace(/\n/g, '<br/>');

      containerRef.current.innerHTML = processedContent;

      // Add click listeners to citation badges
      if (onCitationClick) {
        const citations = containerRef.current.querySelectorAll('.citation-badge');
        citations.forEach((citation) => {
          citation.addEventListener('click', onCitationClick);
        });

        return () => {
          citations.forEach((citation) => {
            citation.removeEventListener('click', onCitationClick);
          });
        };
      }
    } catch (error) {
      console.error('FormattedMessage error:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="text-red-500">Error rendering content: ${error}</div>`;
      }
    }
  }, [content, onCitationClick]);

  return (
    <div
      ref={containerRef}
      className="formatted-content leading-relaxed"
      style={{ wordBreak: 'break-word' }}
    />
  );
}

