import React, { useRef, useState } from 'react';
import { Download, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { Markdown } from './Markdown';
import { MindMap } from './MindMap';

type AudioLanguage = 'en' | 'hi' | 'de' | 'it';

export function OutputsPanel(props: {
  summary: string | null;
  slides: any[];
  audioUrl: string | null;
  mindmapData: any;
  isGeneratingAudio: boolean;
  isGeneratingSlides: boolean;
  isGeneratingPptx?: boolean;
  isGeneratingMindmap: boolean;
  onGenerateAudio: (mode?: 'narration' | 'podcast', language?: AudioLanguage) => void;
  onGenerateSlides: () => void;
  onDownloadPptx?: () => void;
  onGenerateMindmap: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState<AudioLanguage>('en');
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }

    el.load();
    el.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handleDownloadSlides = () => {
    if (props.slides.length === 0) return;
    const content = props.slides
      .map((slide) => `# ${slide.title}\n${(slide.bullets || []).map((b: string) => `* ${b}`).join('\n')}\n`)
      .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation-slides.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-6 p-4">
      <section className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black">Audio Overview</h3>
          <div className="flex items-center gap-2">
            <select
              value={audioLanguage}
              onChange={(e) => setAudioLanguage(e.target.value as AudioLanguage)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-black"
              aria-label="Audio language"
              disabled={props.isGeneratingAudio}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => props.onGenerateAudio('narration', audioLanguage)}
              disabled={props.isGeneratingAudio}
              className="text-xs h-8 bg-black text-white hover:bg-gray-800 hover:text-white border-none"
            >
              {props.isGeneratingAudio ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Narration'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => props.onGenerateAudio('podcast', audioLanguage)}
              disabled={props.isGeneratingAudio}
              className="text-xs h-8 bg-white text-black hover:bg-gray-100 border border-gray-300"
            >
              Podcast
            </Button>
          </div>
        </div>

        {props.audioUrl ? (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full p-2 pr-4 shadow-sm w-full max-w-sm mx-auto">
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-black text-white hover:bg-gray-800 hover:text-white shrink-0"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>

            <div className="flex-1 flex items-center justify-center gap-[2px] h-8 overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-black/80 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"
                  style={{
                    height: `${Math.max(15, Math.random() * 80)}%`,
                    animationDelay: `${i * 0.05}s`,
                    opacity: isPlaying ? 1 : 0.3,
                  }}
                />
              ))}
            </div>

            <audio ref={audioRef} src={props.audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300 rounded bg-white">
            No audio generated yet
          </div>
        )}
      </section>

      <section className="min-h-[400px] h-[400px] flex flex-col relative group">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-black">Mindmap Preview</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={props.onGenerateMindmap}
            disabled={props.isGeneratingMindmap}
            className="text-xs h-8 bg-black text-white hover:bg-gray-800 hover:text-white border-none"
          >
            {props.isGeneratingMindmap ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
          </Button>
        </div>
        <div className="flex-1 w-full">
          <MindMap data={props.mindmapData} />
        </div>
      </section>

      <section className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-black mb-2">Research Summary</h3>
        {props.summary ? (
          <Markdown content={props.summary} className="text-gray-800" />
        ) : (
          <p className="text-gray-400 italic text-sm">Summary will appear here after analysis...</p>
        )}
      </section>

      <section className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black">Presentation Slides</h3>
          <div className="flex gap-2">
            {props.slides.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownloadSlides}
                className="text-xs h-8 text-black hover:bg-gray-100"
                title="Download as Markdown"
              >
                <Download className="h-4 w-4" />
              </Button>
            ) : null}
            {props.slides.length > 0 && props.onDownloadPptx ? (
              <Button
                size="sm"
                variant="outline"
                onClick={props.onDownloadPptx}
                disabled={!!props.isGeneratingPptx}
                className="text-xs h-8 bg-white text-black hover:bg-gray-100 border border-gray-300"
                title="Download as PPTX"
              >
                {props.isGeneratingPptx ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" /> PPTX
                  </>
                )}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={props.onGenerateSlides}
              disabled={props.isGeneratingSlides}
              className="text-xs h-8 bg-black text-white hover:bg-gray-800 hover:text-white border-none"
            >
              {props.isGeneratingSlides ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
            </Button>
          </div>
        </div>

        {props.slides.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {props.slides.map((slide, i) => (
              <div
                key={i}
                className="aspect-video bg-white rounded border border-gray-200 p-2 overflow-hidden hover:scale-105 transition-transform cursor-pointer shadow-sm"
              >
                <h4 className="text-[10px] font-bold text-black truncate">{slide.title}</h4>
                <ul className="mt-1 space-y-0.5">
                  {(slide.bullets || []).slice(0, 3).map((b: string, j: number) => (
                    <li key={j} className="text-[8px] text-gray-600 truncate">
                      - {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300 rounded bg-white">
            No slides generated
          </div>
        )}
      </section>
    </div>
  );
}

