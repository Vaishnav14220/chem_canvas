import { useState, useEffect } from 'react';
import { FileText as FileIcon, ChevronDown, ChevronRight, Search, Filter, Upload, Sparkles, BookOpen, Zap } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { BlurFade } from './ui/blur-fade';
import { MagicCard } from './ui/magic-card';
import { ShineBorder } from './ui/shine-border';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Source {
  id: string;
  name: string;
  type: 'file' | 'link' | 'text';
  content: string;
  url?: string;
  file?: File;
}

interface HighlightedPart {
  sourceId: string;
  text: string;
  startIndex: number;
  endIndex: number;
  relevanceScore: number;
  pageNumber?: number;
}

interface SourcesPanelProps {
  sources: Source[];
  documentName: string;
  documentContent: string;
  highlightedParts: HighlightedPart[];
  currentQuery?: string;
  onDocumentLoad?: (content: string, name: string) => void;
}

export default function SourcesPanel({ 
  sources, 
  documentName, 
  documentContent, 
  highlightedParts,
  currentQuery,
  onDocumentLoad
}: SourcesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredHighlights, setFilteredHighlights] = useState<HighlightedPart[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Extract text from first 15 pages
      const numPages = Math.min(pdf.numPages, 15);
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }

      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      return '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && onDocumentLoad) {
      setIsUploading(true);
      
      let extractedText = '';
      if (selectedFile.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(selectedFile);
      } else if (selectedFile.type === 'text/plain') {
        extractedText = await selectedFile.text();
      }
      
      if (extractedText) {
        onDocumentLoad(extractedText, selectedFile.name);
      }
      
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (currentQuery) {
      // Filter highlights based on current query
      const relevantHighlights = highlightedParts.filter(highlight => 
        highlight.text.toLowerCase().includes(currentQuery.toLowerCase()) ||
        highlight.relevanceScore > 0.7
      );
      setFilteredHighlights(relevantHighlights);
    } else {
      setFilteredHighlights(highlightedParts);
    }
  }, [highlightedParts, currentQuery]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const highlightText = (text: string, highlights: HighlightedPart[]) => {
    if (!highlights.length) return text;

    const sortedHighlights = highlights.sort((a, b) => a.startIndex - b.startIndex);
    const result = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.startIndex > lastIndex) {
        result.push(text.slice(lastIndex, highlight.startIndex));
      }

      // Add highlighted text
      const highlightedText = (
        <span 
          key={`highlight-${index}`}
          className="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded px-1"
          title={`Relevance: ${Math.round(highlight.relevanceScore * 100)}%`}
        >
          {highlight.text}
        </span>
      );
      result.push(highlightedText);

      lastIndex = highlight.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  const splitContentIntoPages = (content: string) => {
    // Split content by page markers or create artificial pages
    const pageMarkers = content.split('--- Page ');
    const pages = pageMarkers.map((page, index) => ({
      number: index === 0 ? 1 : parseInt(page.split(' ---')[0]) || index,
      content: index === 0 ? page : page.split(' ---').slice(1).join(' ---'),
      startIndex: content.indexOf(page),
      endIndex: content.indexOf(page) + page.length
    })).filter(page => page.content.trim());

    return pages;
  };

  if (!documentContent && !sources.length) {
    return (
      <BlurFade delay={0.1} inView>
        <div className="p-6">
          <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 p-8 text-center">
            <ShineBorder 
              shineColor={["#3b82f6", "#8b5cf6", "#6366f1"]} 
              borderWidth={1} 
              duration={10}
            />
            <div className="relative z-10">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/30">
                <BookOpen size={28} className="text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">No sources loaded</h3>
              <p className="text-sm text-slate-400">Upload documents to see content here</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Sparkles size={12} className="text-purple-400" />
                <span>Supports PDF, TXT, and MD files</span>
              </div>
            </div>
          </div>
        </div>
      </BlurFade>
    );
  }

  const pages = documentContent ? splitContentIntoPages(documentContent) : [];

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Upload and Search Bar */}
      <BlurFade delay={0.05} inView>
        <div className="p-3 border-b border-slate-700/50 space-y-3 bg-slate-900/80 backdrop-blur-sm">
          {/* Upload Button */}
          <label className="w-full cursor-pointer block group">
            <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-600 hover:border-blue-400/70 bg-gradient-to-r from-slate-800/50 to-slate-700/30 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/30 group-hover:ring-blue-400/50 transition-all">
                  <Upload size={18} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-slate-200 block">
                    {isUploading ? 'Uploading...' : 'Upload Document'}
                  </span>
                  <span className="text-xs text-slate-500">Drop or click to browse</span>
                </div>
              </div>
              {isUploading && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse w-full" />
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Search Bar */}
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search in sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </BlurFade>

      {/* Source Guide */}
      <BlurFade delay={0.1} inView>
        <div className="px-3 py-2 border-b border-slate-700/30">
          <button
            onClick={() => toggleSection('source-guide')}
            className="w-full flex items-center justify-between text-left hover:bg-slate-800/50 rounded-lg px-3 py-2.5 transition-all duration-200 group"
          >
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-sm font-medium text-slate-200">Source guide</span>
            </div>
            {expandedSections.has('source-guide') ? (
              <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-200 transition-colors" />
            ) : (
              <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-200 transition-colors" />
            )}
          </button>
          
          {expandedSections.has('source-guide') && (
            <BlurFade delay={0.05} inView>
              <div className="mt-2 ml-4 space-y-1.5 pb-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>Click highlighted text to see full context</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>Relevance scores show match quality</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  <span>Page numbers help locate information</span>
                </div>
              </div>
            </BlurFade>
          )}
        </div>
      </BlurFade>

      {/* Main Document */}
      {documentName && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            {/* Document Header */}
            <BlurFade delay={0.15} inView>
              <MagicCard 
                className="rounded-xl mb-4" 
                gradientFrom="#3b82f6" 
                gradientTo="#8b5cf6"
                gradientSize={150}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/30">
                      <FileIcon size={18} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{documentName}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 ring-1 ring-slate-700/50">
                          📄 Document
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 ring-1 ring-slate-700/50">
                          {pages.length} pages
                        </span>
                        {filteredHighlights.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 ring-1 ring-blue-500/30 text-blue-400">
                            <Sparkles size={10} />
                            {filteredHighlights.length} highlights
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </MagicCard>
            </BlurFade>

            {/* Document Content with Highlights */}
            <div className="space-y-3">
              {pages.map((page, pageIndex) => {
                const pageHighlights = filteredHighlights.filter(h => 
                  h.startIndex >= page.startIndex && h.endIndex <= page.endIndex
                );

                return (
                  <BlurFade key={pageIndex} delay={0.1 + pageIndex * 0.03} inView>
                    <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 ring-1 ring-blue-500/30 text-xs font-medium text-blue-400">
                          Page {page.number}
                        </span>
                        {pageHighlights.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 ring-1 ring-amber-500/30 text-xs font-medium text-amber-400">
                            <Sparkles size={10} />
                            {pageHighlights.length} matches
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                        {highlightText(page.content, pageHighlights)}
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Additional Sources */}
      {sources.length > 1 && (
        <BlurFade delay={0.2} inView>
          <div className="border-t border-slate-700/50 p-3 bg-slate-900/50">
            <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-purple-400" />
              Additional Sources
            </h5>
            <div className="space-y-2">
              {sources.slice(1).map((source, index) => (
                <BlurFade key={source.id} delay={0.05 * index} inView>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 transition-all group cursor-pointer">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 group-hover:bg-slate-700 transition-colors">
                      <FileIcon size={14} className="text-slate-400 group-hover:text-slate-200" />
                    </div>
                    <span className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{source.name}</span>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </BlurFade>
      )}

      {/* Highlight Summary */}
      {filteredHighlights.length > 0 && (
        <BlurFade delay={0.25} inView>
          <div className="border-t border-slate-700/50 p-3 bg-gradient-to-t from-slate-900 to-slate-800/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/30">
                <Filter size={12} className="text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-white">Query Matches</span>
              <span className="ml-auto text-xs text-slate-500">{filteredHighlights.length} total</span>
            </div>
            <div className="space-y-2">
              {filteredHighlights.slice(0, 3).map((highlight, index) => (
                <BlurFade key={index} delay={0.05 * index} inView>
                  <div className="relative overflow-hidden rounded-lg p-3 bg-slate-800/50 border border-amber-500/20 hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-xs font-medium text-amber-400">
                        <Zap size={10} />
                        {Math.round(highlight.relevanceScore * 100)}% match
                      </span>
                      {highlight.pageNumber && (
                        <span className="text-xs text-blue-400">Page {highlight.pageNumber}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{highlight.text}</p>
                  </div>
                </BlurFade>
              ))}
              {filteredHighlights.length > 3 && (
                <p className="text-xs text-slate-500 text-center py-2 bg-slate-800/30 rounded-lg">
                  +{filteredHighlights.length - 3} more matches
                </p>
              )}
            </div>
          </div>
        </BlurFade>
      )}
    </div>
  );
}

