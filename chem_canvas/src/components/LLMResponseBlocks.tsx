import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Loader2 } from 'lucide-react';
import { fetchCanonicalSmiles } from '../services/pubchemService';
import 'katex/dist/katex.min.css';

const SMILES_CODE_REGEX = /`([^`]+)`/g;
const SMILES_LABEL_REGEX = /SMILES[^:]*[:\-]\s*([A-Za-z0-9@+\-\[\]\(\)\\\/=#$%]+)(?=\s|$)/gi;

const extractSmilesCandidates = (text: string): string[] => {
  const results = new Set<string>();

  for (const match of text.matchAll(SMILES_CODE_REGEX)) {
    const candidate = match[1]?.trim();
    if (candidate) {
      results.add(candidate);
    }
  }

  for (const match of text.matchAll(SMILES_LABEL_REGEX)) {
    const candidate = match[1]?.trim();
    if (candidate) {
      results.add(candidate);
    }
  }

  return Array.from(results);
};

const verifySmilesList = async (candidates: string[]): Promise<string[]> => {
  const verified: string[] = [];
  for (const candidate of candidates) {
    try {
      const canonical = await fetchCanonicalSmiles(candidate);
      if (canonical) {
        verified.push(canonical);
        continue;
      }
    } catch (err) {
      console.warn('PubChem SMILES lookup failed:', err);
    }
    // Fallback to raw candidate if canonicalization fails
    verified.push(candidate);
  }
  return Array.from(new Set(verified));
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API copy failed, attempting fallback:', error);
    }
  }

  if (typeof document !== 'undefined') {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const succeeded = document.execCommand('copy');
      return succeeded;
    } catch (error) {
      console.error('Fallback clipboard copy failed:', error);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  console.warn('Clipboard copy unavailable in this environment.');
  return false;
};

export const VerifiedSmilesBlock = ({ sourceText }: { sourceText: string }) => {
  const [verified, setVerified] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedSmiles, setCopiedSmiles] = useState<string | null>(null);
  const resetCopyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    try {
      const candidates = extractSmilesCandidates(sourceText);
      if (!candidates.length) {
        setVerified([]);
        return;
      }

      setIsChecking(true);
      verifySmilesList(candidates)
        .then(list => {
          if (isMounted) {
            setVerified(list);
          }
        })
        .catch(err => {
          console.warn('Error verifying SMILES list:', err);
          if (isMounted) setVerified(candidates);
        })
        .finally(() => {
          if (isMounted) setIsChecking(false);
        });
    } catch (error) {
      console.warn('Error in SMILES extraction:', error);
      setVerified([]);
      setIsChecking(false);
    }

    return () => {
      isMounted = false;
    };
  }, [sourceText]);

  useEffect(() => {
    setCopiedSmiles(null);
    if (resetCopyTimeoutRef.current !== null) {
      window.clearTimeout(resetCopyTimeoutRef.current);
      resetCopyTimeoutRef.current = null;
    }
  }, [verified]);

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async (smiles: string) => {
    try {
      const success = await copyTextToClipboard(smiles);
      if (success) {
        setCopiedSmiles(smiles);
        if (resetCopyTimeoutRef.current !== null) {
          window.clearTimeout(resetCopyTimeoutRef.current);
        }
        resetCopyTimeoutRef.current = window.setTimeout(() => {
          setCopiedSmiles(null);
          resetCopyTimeoutRef.current = null;
        }, 2000);
      }
    } catch (error) {
      console.warn('Error copying SMILES:', error);
    }
  }, []);

  if (!verified.length) {
    return null;
  }

  try {
    return (
      <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-300 flex items-center gap-1">
          Suggested SMILES {isChecking && <Loader2 size={12} className="animate-spin text-blue-300" />}
        </p>
        {verified.map((smiles, idx) => (
          <div key={`${smiles}-${idx}`} className="flex items-center justify-between gap-2 bg-gray-800/70 rounded-lg px-3 py-2">
            <span className="text-xs font-mono text-gray-100 break-all">{smiles}</span>
            <button
              onClick={() => {
                void handleCopy(smiles);
              }}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/30 hover:bg-blue-900/40 px-2 py-1 rounded-md transition-colors"
              title="Copy SMILES"
            >
              <Copy size={14} />
              {copiedSmiles === smiles ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}
        <p className="text-[10px] text-gray-400">Copy the SMILES and paste it into NMRium&apos;s molecule input to visualize the structure.</p>
      </div>
    );
  } catch (error) {
    console.warn('Error rendering SMILES block:', error);
    return null;
  }
};

export function LLMMessage({ content, onCitationClick: _onCitationClick }: { content: string; onCitationClick?: () => void }) {
  if (!content?.trim()) {
    return null;
  }
  // Normalize content: some LLM outputs embed escaped newlines ("\\n") or tabs.
  // Convert common escaped sequences to their literal characters so Markdown renders correctly.
  const normalizeContent = (txt: string) => {
    if (!txt) return txt;
    try {
      // Replace escaped newlines and tabs with real ones
      let s = txt.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      // Normalize CRLF to LF
      s = s.replace(/\r\n/g, '\n');
      // Trim accidental leading/trailing whitespace that can break Markdown blocks
      s = s.trim();
      return s;
    } catch (err) {
      return txt;
    }
  };

  const normalized = normalizeContent(content);

  const renderMarkdown = (text: string) => {
    try {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: ({ node, ...props }) => (
              <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />
            ),
            code: ({ className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              if (match) {
                return (
                  <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 overflow-x-auto text-xs">
                    <code className={className}>{children}</code>
                  </pre>
                );
              }
              return (
                <code className="bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-xs" {...props}>
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-gray-700">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-gray-700 px-3 py-2 bg-gray-800 font-semibold text-sm">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-700 px-3 py-2 text-sm">
                {children}
              </td>
            ),
            li: ({ children }) => (
              <li className="mb-1">
                {children}
              </li>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      );
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return <div className="text-red-400">Error rendering markdown</div>;
    }
  };

  return (
    <div className="space-y-4">
      {renderMarkdown(normalized)}
      <VerifiedSmilesBlock sourceText={content} />
    </div>
  );
}
