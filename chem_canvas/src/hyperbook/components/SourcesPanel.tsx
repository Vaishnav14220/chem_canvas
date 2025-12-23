import { FileText, Link2, Plus, StickyNote, Trash2 } from 'lucide-react';
import type { Source } from '../lib/types';
import { truncateUrl } from '../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useRef, useState } from 'react';

export function SourcesPanel(props: {
  sources: Source[];
  onAddUrl: (url: string) => void | Promise<void>;
  onAddFile: (file: File) => void | Promise<void>;
  onAddText: (title: string, text: string) => void | Promise<void>;
  onRemoveSource: (id: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<'url' | 'file' | 'notes'>('url');
  const [url, setUrl] = useState('');
  const [notesTitle, setNotesTitle] = useState('');
  const [notesText, setNotesText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSources = props.sources;
  const activeCount = activeSources.length;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-black leading-tight">Sources</h2>
            <p className="text-sm text-gray-600 mt-1">Add content to your notebook</p>
          </div>
          <div className="text-xs font-semibold text-gray-600 tabular-nums">{activeCount}</div>
        </div>

        <div className="mt-5 rounded-xl bg-gray-100 p-1 grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={props.isLoading}
            onClick={() => setMode('url')}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'url' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-gray-700 hover:bg-white/70'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Link2 className="h-4 w-4" />
              URL
            </span>
          </button>
          <button
            type="button"
            disabled={props.isLoading}
            onClick={() => setMode('file')}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'file' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-gray-700 hover:bg-white/70'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              File
            </span>
          </button>
          <button
            type="button"
            disabled={props.isLoading}
            onClick={() => setMode('notes')}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'notes' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-gray-700 hover:bg-white/70'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes
            </span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === 'url' ? (
            <>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={props.isLoading}
                placeholder="Paste URL (e.g. https://example.com)..."
                className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <Button
                onClick={async () => {
                  const v = url.trim();
                  if (!v) return;
                  await props.onAddUrl(v);
                  setUrl('');
                }}
                disabled={props.isLoading || !url.trim()}
                className="w-full h-11 bg-gray-700 hover:bg-gray-800 text-white font-semibold"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Source
                </span>
              </Button>
            </>
          ) : mode === 'file' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await props.onAddFile(file);
                  e.currentTarget.value = '';
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={props.isLoading}
                className="w-full h-11 bg-white text-black border border-gray-300 hover:bg-gray-50 font-semibold"
              >
                Choose PDF / TXT File
              </Button>
            </>
          ) : (
            <>
              <input
                value={notesTitle}
                onChange={(e) => setNotesTitle(e.target.value)}
                disabled={props.isLoading}
                placeholder="Notes title (optional)"
                className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                disabled={props.isLoading}
                placeholder="Paste or type notes here..."
                className="w-full min-h-[140px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <Button
                onClick={async () => {
                  const text = notesText.trim();
                  if (!text) return;
                  await props.onAddText(notesTitle, notesText);
                  setNotesTitle('');
                  setNotesText('');
                }}
                disabled={props.isLoading || !notesText.trim()}
                className="w-full h-11 bg-gray-700 hover:bg-gray-800 text-white font-semibold"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Add Notes
                </span>
              </Button>
            </>
          )}

          <Button
            onClick={props.onAnalyze}
            disabled={props.isLoading || props.sources.filter((s) => s.status === 'success').length === 0}
            className="w-full h-11 bg-black hover:bg-gray-900 text-white font-semibold"
          >
            Analyze All
          </Button>
        </div>
      </div>

      <div className="px-6 pt-5 pb-3">
        <div className="text-xs font-semibold tracking-wider text-gray-600">
          ACTIVE SOURCES <span className="tabular-nums">({activeCount})</span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="min-h-full px-6 pb-8 flex flex-col">
          {activeCount === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-sm text-gray-400">No sources added yet</div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSources.map((s) => (
                <div key={s.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                        <p className="text-sm font-semibold text-black truncate">{s.title || truncateUrl(s.url)}</p>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-1">{truncateUrl(s.url)}</p>
                    </div>
                    <button
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                      onClick={() => props.onRemoveSource(s.id)}
                      title="Remove"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3">
                    {s.status === 'loading' ? (
                      <p className="text-xs text-gray-500">Loading...</p>
                    ) : s.status === 'error' ? (
                      <p className="text-xs text-red-600">{s.error || 'Failed to load'}</p>
                    ) : (
                      <p className="text-xs text-green-600">Ready</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
