import { useState, useEffect } from 'react';
import { FileText as FileIcon, ChevronDown, ChevronRight, Search, Filter, Upload, Plus } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

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
      <div className="p-4">
        <div className="text-center py-8">
          <FileIcon size={48} className="text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No sources loaded</p>
          <p className="text-xs text-gray-500 mt-1">Upload documents to see content here</p>
        </div>
      </div>
    );
  }

  const pages = documentContent ? splitContentIntoPages(documentContent) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Upload and Search Bar */}
      <div className="p-3 border-b border-gray-700 space-y-3">
        {/* Upload Button */}
        <label className="w-full cursor-pointer block">
          <div className="border border-dashed border-gray-600 hover:border-blue-400 hover:bg-blue-900/20 rounded-lg p-3 transition-all">
            <div className="flex items-center justify-center gap-2">
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </span>
            </div>
          </div>
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search in sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Source Guide */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={() => toggleSection('source-guide')}
          className="w-full flex items-center justify-between text-left hover:bg-gray-700 rounded-lg p-2 transition-colors"
        >
          <span className="text-sm font-medium text-white">Source guide</span>
          {expandedSections.has('source-guide') ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('source-guide') && (
          <div className="mt-2 ml-4 text-xs text-gray-400">
            <p>• Click highlighted text to see full context</p>
            <p>• Relevance scores show match quality</p>
            <p>• Page numbers help locate information</p>
          </div>
        )}
      </div>

      {/* Main Document */}
      {documentName && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            {/* Document Header */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-white mb-1">{documentName}</h4>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>📄 Document</span>
                <span>•</span>
                <span>{pages.length} pages</span>
                {filteredHighlights.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400">{filteredHighlights.length} highlights</span>
                  </>
                )}
              </div>
            </div>

            {/* Document Content with Highlights */}
            <div className="space-y-3">
              {pages.map((page, pageIndex) => {
                const pageHighlights = filteredHighlights.filter(h => 
                  h.startIndex >= page.startIndex && h.endIndex <= page.endIndex
                );

                return (
                  <div key={pageIndex} className="border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-400">Page {page.number}</span>
                      {pageHighlights.length > 0 && (
                        <span className="text-xs text-yellow-400">{pageHighlights.length} matches</span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-300 leading-relaxed">
                      {highlightText(page.content, pageHighlights)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Additional Sources */}
      {sources.length > 1 && (
        <div className="border-t border-gray-700 p-3">
          <h5 className="text-sm font-medium text-gray-300 mb-2">Additional Sources</h5>
          <div className="space-y-2">
            {sources.slice(1).map((source) => (
              <div key={source.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
                <FileIcon size={14} className="text-gray-400" />
                <span className="text-xs text-gray-300 truncate">{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlight Summary */}
      {filteredHighlights.length > 0 && (
        <div className="border-t border-gray-700 p-3 bg-gray-750">
          <div className="flex items-center gap-2 mb-2">
            <Filter size={14} className="text-blue-400" />
            <span className="text-xs font-medium text-white">Query Matches</span>
          </div>
          <div className="space-y-1">
            {filteredHighlights.slice(0, 3).map((highlight, index) => (
              <div key={index} className="text-xs text-gray-300 p-2 bg-gray-800 rounded border border-yellow-400/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-yellow-400 font-medium">
                    {Math.round(highlight.relevanceScore * 100)}% match
                  </span>
                  {highlight.pageNumber && (
                    <span className="text-blue-400">Page {highlight.pageNumber}</span>
                  )}
                </div>
                <p className="line-clamp-2">{highlight.text}</p>
              </div>
            ))}
            {filteredHighlights.length > 3 && (
              <p className="text-xs text-gray-400 text-center">
                +{filteredHighlights.length - 3} more matches
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
