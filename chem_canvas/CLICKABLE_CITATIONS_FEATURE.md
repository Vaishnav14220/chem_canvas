# Clickable Citations with PDF Viewer Feature

## Overview
The Document Understanding workspace now includes **clickable citations** that open the PDF document on the right side with the relevant page and highlighted text.

## How It Works

### 1. **AI-Generated Citations**
When you chat with a document, the AI assistant now provides citations in this format:
```
[Citation|Page X: "exact quote from document"]
```
or
```
[Citation: "exact quote from document"]
```

### 2. **Interactive Citation Buttons**
Citations appear as **clickable cyan buttons** in the chat interface:
- Click any citation button to open the PDF viewer
- The button shows the page number (if available)
- Hover to see a preview of the quoted text

### 3. **Split-Screen PDF Viewer**
When you click a citation:
- The chat modal expands to show both chat and PDF side-by-side
- PDF viewer appears on the right half of the screen
- The relevant page is automatically loaded
- Text search is performed to locate the citation

### 4. **PDF Navigation**
The PDF viewer includes:
- **Canvas display** - High-quality rendering of PDF pages
- **Page navigation** - Previous/Next buttons to browse pages
- **Page counter** - Shows current page and total pages
- **Close button** - Dismiss the PDF viewer while keeping chat open
- **Search indicator** - Shows what text is being highlighted

## Features

### Visual Elements
- **Cyan citation buttons** with external link icon
- **Split-screen layout** - Chat on left, PDF on right
- **Smooth transitions** - Animated expansion when PDF opens
- **Dark theme** - Consistent with the rest of the UI

### Technical Implementation
- Uses **PDF.js** library for rendering
- **Page-by-page rendering** on HTML5 canvas
- **Text extraction** for search and highlighting
- **Lazy loading** - PDF only loads when first citation is clicked
- **State management** - Tracks current page, highlight text, and viewer visibility

## User Workflow

1. **Upload a PDF document**
2. **Open "Chat with Document"**
3. **Ask a question** (e.g., "What are the main findings?")
4. **Receive answer with citations** - Look for cyan citation buttons
5. **Click any citation** - PDF viewer opens on the right
6. **Review the source** - See the exact page and context
7. **Navigate pages** - Use Previous/Next to explore
8. **Continue chatting** - PDF stays open while you ask more questions

## Example Citations

### With Page Number:
```markdown
The study found that [Citation|Page 5: "temperature significantly affects reaction rate"].
```
Shows: **Page 5** button

### Without Page Number:
```markdown
According to the methodology [Citation: "samples were analyzed using HPLC"].
```
Shows: **Citation** button

## Benefits

✅ **Source verification** - Instantly check AI answers against original document  
✅ **Context awareness** - See citations in their full context  
✅ **Efficient research** - No need to manually search through PDF  
✅ **Academic integrity** - Proper attribution with exact quotes  
✅ **Side-by-side comparison** - Read answer and source simultaneously  

## Technical Details

### Libraries Used
- **pdfjs-dist** - PDF rendering engine
- **React hooks** - State management (useState, useEffect, useRef)
- **Canvas API** - High-quality page rendering
- **Regex parsing** - Citation format detection

### State Variables
```typescript
const [pdfFile, setPdfFile] = useState<File | null>(null);
const [showPdfViewer, setShowPdfViewer] = useState(false);
const [pdfPageNumber, setPdfPageNumber] = useState(1);
const [pdfTotalPages, setPdfTotalPages] = useState(0);
const [highlightText, setHighlightText] = useState<string>('');
const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
const pdfDocumentRef = useRef<any>(null);
```

### Key Functions
- `loadPdfDocument(file)` - Loads PDF into memory
- `renderPdfPage(pageNum)` - Renders specific page to canvas
- `handleCitationClick(text, page)` - Opens viewer and navigates to citation
- `CitationText` - Custom React component to parse and render clickable citations

## Browser Compatibility
- ✅ Chrome, Edge, Firefox - Full support
- ✅ Safari - Full support
- ⚠️ Mobile browsers - Works but smaller screen may be challenging for split-view

## Future Enhancements
- 🔜 Text highlighting on PDF canvas
- 🔜 Zoom in/out controls
- 🔜 Download specific pages
- 🔜 Copy citation to clipboard
- 🔜 Multiple citation highlighting on same page

## Notes
- PDF.js worker is loaded from CDN for optimal performance
- Canvas rendering uses 1.5x scale for clarity
- Citations are parsed using regex pattern matching
- PDF stays loaded in memory for fast page switching
