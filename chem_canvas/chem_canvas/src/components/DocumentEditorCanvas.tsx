import React, { useEffect, useRef, useState } from 'react';
import Editor, {
  Command,
  EditorMode,
  EditorZone,
  IElement,
  RowFlex,
  ElementType,
  TitleLevel,
  ListType,
  ListStyle,
  TextDecorationStyle,
  PageMode,
  PaperDirection,
  ControlType,
  BlockType,
  IContextMenuContext,
  splitText
} from '@hufe921/canvas-editor';
import './DocumentEditorStyles.css';
import {
  initializeGeminiWithFirebaseKey,
  generateContentWithGemini
} from '../services/geminiService';
import { translateChineseToEnglish } from './DocumentEditorI18n';

interface DocumentEditorCanvasProps {
  onReady?: (editor: any) => void;
  initialContent?: IElement[];
  mode?: EditorMode;
  onContentChange?: (content: IElement[]) => void;
}

const DocumentEditorCanvas: React.FC<DocumentEditorCanvasProps> = ({
  onReady,
  initialContent,
  mode = EditorMode.EDIT,
  onContentChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any | null>(null);
  const [currentMode, setCurrentMode] = useState(mode);

  // Initialize Gemini for AI features using Firebase-stored key
  useEffect(() => {
    initializeGeminiWithFirebaseKey().catch(error => {
      console.warn('Could not initialize Gemini for AI features:', error);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Default content with English text
    const defaultContent: IElement[] = initialContent || [
      {
        value: 'Welcome to Document Editor',
        size: 24,
        bold: true,
        rowFlex: RowFlex.CENTER,
      },
      {
        value: '\n',
      },
      {
        value: 'This is a powerful document editor similar to Microsoft Word. You can:',
        size: 16,
      },
      {
        value: '\n',
      },
      {
        value: '• Format text with bold, italic, underline, and more',
        size: 14,
      },
      {
        value: '\n',
      },
      {
        value: '• Insert tables, images, and hyperlinks',
        size: 14,
      },
      {
        value: '\n',
      },
      {
        value: '• Create lists and structured documents',
        size: 14,
      },
      {
        value: '\n',
      },
      {
        value: '• Add code blocks and mathematical formulas',
        size: 14,
      },
      {
        value: '\n',
      },
      {
        value: 'Start typing to replace this content...',
        size: 14,
        color: '#666666',
        italic: true,
      },
    ];

    // Editor configuration with English text only
    const options = {
      mode: currentMode,
      locale: 'en',
      defaultType: 'A4' as const,
      defaultColor: '#000000',
      defaultFont: 'Arial',
      defaultSize: 16,
      minSize: 5,
      maxSize: 72,
      defaultRowMargin: 1.5,
      defaultTabWidth: 32,
      wordBreak: 'BREAK_WORD' as const,
      watermark: {
        data: 'DRAFT',
        color: '#AEB5C0',
        opacity: 0.1,
        size: 120,
        repeat: false,
      },
      placeholder: {
        data: 'Click here to start typing...',
        color: '#999999',
        size: 16,
      },
      margins: [120, 120, 120, 120], // Top, Right, Bottom, Left
      paperDirection: PaperDirection.VERTICAL,
      pageMode: PageMode.PAGING,
      pageNumber: {
        display: true,
        format: 'Page {pageNo}/{pageCount}',
        color: '#666666',
        size: 12,
      },
      header: {
        disabled: false,
        maxHeight: 50,
      },
      footer: {
        disabled: false,
        maxHeight: 50,
      },
    };

    try {
      const editor = new Editor(
        containerRef.current,
        {
          header: [],
          main: defaultContent,
          footer: [],
        },
        options
      );

      editorRef.current = editor;
      editor.command.executePageMode(PageMode.PAGING);

      // Register custom context menu with AI features
      if (editor.register) {
        editor.register.contextMenuList([
          {
            name: '──────────',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection;
            },
          },
          {
            name: '✨ AI Rephrase',
            icon: 'rephrase',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              try {
                const prompt = `Rephrase the following text to be clearer and more professional while maintaining the same meaning:\n\n"${selectedText}"\n\nProvide only the rephrased text without any explanation.`;
                const result = await generateContentWithGemini(prompt);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI rephrase failed:', error);
                alert('AI rephrase failed. Please check your API key.');
              }
            },
          },
          {
            name: '📝 AI Improve Writing',
            icon: 'improve',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              try {
                const prompt = `Improve the following text by fixing grammar, enhancing clarity, and making it more engaging:\n\n"${selectedText}"\n\nProvide only the improved text without any explanation.`;
                const result = await generateContentWithGemini(prompt);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI improve failed:', error);
                alert('AI improvement failed. Please check your API key.');
              }
            },
          },
          {
            name: '📊 AI Summarize',
            icon: 'summarize',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              try {
                const prompt = `Summarize the following text concisely while keeping the key points:\n\n"${selectedText}"\n\nProvide only the summary without any explanation.`;
                const result = await generateContentWithGemini(prompt);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI summarize failed:', error);
                alert('AI summarization failed. Please check your API key.');
              }
            },
          },
          {
            name: '🔄 AI Translate',
            icon: 'translate',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              const targetLang = prompt('Enter target language (e.g., Spanish, French, Chinese):');
              if (!targetLang) return;
              
              try {
                const promptText = `Translate the following text to ${targetLang}:\n\n"${selectedText}"\n\nProvide only the translation without any explanation.`;
                const result = await generateContentWithGemini(promptText);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI translate failed:', error);
                alert('AI translation failed. Please check your API key.');
              }
            },
          },
          {
            name: '📚 AI Expand',
            icon: 'expand',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              try {
                const prompt = `Expand on the following text with more details and examples:\n\n"${selectedText}"\n\nProvide an expanded version that is 2-3 times longer.`;
                const result = await generateContentWithGemini(prompt);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI expand failed:', error);
                alert('AI expansion failed. Please check your API key.');
              }
            },
          },
          {
            name: '🎯 AI Simplify',
            icon: 'simplify',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection && !payload.isReadonly;
            },
            callback: async (command: Command) => {
              const selectedText = command.getRangeText();
              if (!selectedText) return;
              
              try {
                const prompt = `Simplify the following text to make it easier to understand, using simpler words and shorter sentences:\n\n"${selectedText}"\n\nProvide only the simplified text without any explanation.`;
                const result = await generateContentWithGemini(prompt);
                if (result) {
                  command.executeBackspace();
                  insertAiResponse(command, result);
                }
              } catch (error) {
                console.error('AI simplify failed:', error);
                alert('AI simplification failed. Please check your API key.');
              }
            },
          },
          {
            name: '──────────',
            when: (payload: IContextMenuContext) => {
              return payload.editorHasSelection;
            },
          },
        ]);
      }

      // Override default context menu to ensure English
      if (editor.override) {
        const originalContextMenu = editor.getContextMenu?.bind(editor);
        if (originalContextMenu) {
          editor.override.contextMenu = function(contextMenuList: any[]) {
            // Replace Chinese text with English using the translation helper
            return contextMenuList.map(item => {
              if (typeof item.name === 'string') {
                // Use the translation function for comprehensive coverage
                item.name = translateChineseToEnglish(item.name);
                
              }
              
              // Recursively handle submenus
              if (item.children && Array.isArray(item.children)) {
                item.children = item.children.map((child: any) => {
                  if (typeof child.name === 'string') {
                    child.name = translateChineseToEnglish(child.name);
                  }
                  return child;
                });
              }
              
              return item;
            });
          };
        }
      }

      // Set up event listeners
      if (editor.listener) {
        editor.listener.contentChange = () => {
          if (onContentChange) {
            const content = editor.command.getValue();
            onContentChange(content.main);
          }
        };
      }

      if (onReady) {
        onReady(editor);
      }
    } catch (error) {
      console.error('Failed to initialize editor:', error);
    }

    return () => {
      if (editorRef.current?.destroy) {
        editorRef.current.destroy();
      }
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeMode(mode);
      setCurrentMode(mode);
    }
  }, [mode]);

  const handleBold = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeBold();
    }
  };

  const handleItalic = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeItalic();
    }
  };

  const handleUnderline = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeUnderline();
    }
  };

  const handleUndo = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeUndo();
    }
  };

  const handleRedo = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeRedo();
    }
  };

  const handleInsertTable = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeInsertTable(3, 3);
    }
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            if (editorRef.current?.command) {
              editorRef.current.command.executeImage({
                value: event.target.result,
                width: img.width > 500 ? 500 : img.width,
                height: img.width > 500 ? (img.height * 500) / img.width : img.height,
              });
            }
          };
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handlePrint = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executePrint();
    }
  };

  const handleSearch = () => {
    const searchTerm = prompt('Enter search term:');
    if (searchTerm && editorRef.current?.command) {
      editorRef.current.command.executeSearch(searchTerm);
    }
  };

  const handleInsertList = (listType: ListType, listStyle: ListStyle) => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeList(listType, listStyle);
    }
  };

  const formatAiTextToElements = (text: string): IElement[] => {
    const sanitized = text
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .trim();

    if (!sanitized) {
      return [];
    }

    const paragraphs = sanitized.split(/\n\s*\n/);
    const elements: IElement[] = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) {
        return;
      }

      const lines = trimmedParagraph.split(/\n/).map(line => line.trim()).filter(Boolean);
      lines.forEach((line, lineIndex) => {
        const tokens = splitText(line);
        if (tokens.length) {
          tokens.forEach(token => {
            elements.push({ value: token });
          });
        } else {
          elements.push({ value: line });
        }

        if (lineIndex < lines.length - 1) {
          elements.push({ value: '\n' });
        }
      });

      if (paragraphIndex < paragraphs.length - 1) {
        elements.push({ value: '\n' });
      }
    });

    elements.push({ value: '\n' });
    return elements;
  };

  const insertAiResponse = (command: Command, response: string) => {
    const formattedElements = formatAiTextToElements(response);
    if (!formattedElements.length) {
      return;
    }
    command.executeInsertElementList(formattedElements);
  };

  const handleInsertSeparator = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeSeparator();
    }
  };

  const handleInsertPageBreak = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executePageBreak();
    }
  };

  const handleInsertWatermark = () => {
    const text = prompt('Enter watermark text:');
    if (text && editorRef.current?.command) {
      editorRef.current.command.executeAddWatermark({
        data: text,
        color: '#AEB5C0',
        opacity: 0.15,
        size: 100,
        repeat: true,
      });
    }
  };

  const handleRemoveWatermark = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeDeleteWatermark();
    }
  };

  const handleInsertCheckbox = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeInsertElementList([
        {
          type: ElementType.CHECKBOX,
          checkbox: {
            value: false
          },
          value: ''
        }
      ]);
    }
  };

  const handleInsertDate = () => {
    if (editorRef.current?.command) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      editorRef.current.command.executeInsertElementList([
        {
          type: ElementType.DATE,
          value: '',
          dateFormat: 'yyyy-MM-dd',
          valueList: [
            {
              value: dateStr
            }
          ]
        }
      ]);
    }
  };

  const handleInsertCodeBlock = () => {
    const code = prompt('Enter code:');
    if (code && editorRef.current?.command) {
      editorRef.current.command.executeInsertElementList([
        { value: '\n' },
        { value: code, color: '#0969da', highlight: '#f6f8fa' },
        { value: '\n' },
      ]);
    }
  };

  const handlePageSetup = () => {
    if (editorRef.current?.command) {
      const width = prompt('Enter page width (pixels):', '794');
      const height = prompt('Enter page height (pixels):', '1123');
      if (width && height) {
        editorRef.current.command.executePaperSize(Number(width), Number(height));
      }
    }
  };

  const handleSetMargins = () => {
    if (editorRef.current?.command) {
      const margin = prompt('Enter margin size (pixels):', '120');
      if (margin) {
        const marginValue = Number(margin);
        editorRef.current.command.executeSetPaperMargin([marginValue, marginValue, marginValue, marginValue]);
      }
    }
  };

  const handleFormatPainter = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executePainter({ isDblclick: false });
    }
  };

  const handleClearFormatting = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeFormat();
    }
  };

  const handleStrikethrough = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeStrikeout();
    }
  };

  const handleSuperscript = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeSuperscript();
    }
  };

  const handleSubscript = () => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeSubscript();
    }
  };

  const handleHighlight = () => {
    const color = prompt('Enter highlight color (e.g., #ffff00 for yellow):', '#ffff00');
    if (color && editorRef.current?.command) {
      editorRef.current.command.executeHighlight(color);
    }
  };

  const handleFontColor = () => {
    const color = prompt('Enter text color (e.g., #000000 for black):', '#000000');
    if (color && editorRef.current?.command) {
      editorRef.current.command.executeColor(color);
    }
  };

  const handleAlignment = (alignment: RowFlex) => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeRowFlex(alignment);
    }
  };

  const handleFontSize = (increase: boolean) => {
    if (editorRef.current?.command) {
      if (increase) {
        editorRef.current.command.executeSizeAdd();
      } else {
        editorRef.current.command.executeSizeMinus();
      }
    }
  };

  const handleTitle = (level: TitleLevel | null) => {
    if (editorRef.current?.command) {
      editorRef.current.command.executeTitle(level);
    }
  };

  return (
    <div className="document-editor-container">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onClick={handleUndo} title="Undo (Ctrl+Z)" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
          </button>
          <button onClick={handleRedo} title="Redo (Ctrl+Y)" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={handleFormatPainter} title="Format Painter (Double-click to keep active)" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z"/>
            </svg>
          </button>
          <button onClick={handleClearFormatting} title="Clear Formatting" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={handleBold} title="Bold (Ctrl+B)" className="toolbar-btn">
            <strong>B</strong>
          </button>
          <button onClick={handleItalic} title="Italic (Ctrl+I)" className="toolbar-btn">
            <em>I</em>
          </button>
          <button onClick={handleUnderline} title="Underline (Ctrl+U)" className="toolbar-btn">
            <u>U</u>
          </button>
          <button onClick={handleStrikethrough} title="Strikethrough (Ctrl+Shift+X)" className="toolbar-btn">
            <s>S</s>
          </button>
          <button onClick={handleSuperscript} title="Superscript (Ctrl+Shift+,)" className="toolbar-btn">
            X<sup>2</sup>
          </button>
          <button onClick={handleSubscript} title="Subscript (Ctrl+Shift+.)" className="toolbar-btn">
            H<sub>2</sub>O
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={() => handleFontSize(false)} title="Decrease Font Size" className="toolbar-btn">
            <span style={{ fontSize: '12px' }}>A-</span>
          </button>
          <button onClick={() => handleFontSize(true)} title="Increase Font Size" className="toolbar-btn">
            <span style={{ fontSize: '18px' }}>A+</span>
          </button>
          <button onClick={handleFontColor} title="Font Color" className="toolbar-btn">
            <span style={{ textDecoration: 'underline', textDecorationColor: '#ff0000', textDecorationThickness: '3px' }}>A</span>
          </button>
          <button onClick={handleHighlight} title="Text Highlight Color" className="toolbar-btn">
            <span style={{ backgroundColor: '#ffff00', padding: '2px' }}>ab</span>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={() => handleAlignment(RowFlex.LEFT)} title="Align Left" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
            </svg>
          </button>
          <button onClick={() => handleAlignment(RowFlex.CENTER)} title="Align Center" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
            </svg>
          </button>
          <button onClick={() => handleAlignment(RowFlex.RIGHT)} title="Align Right" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>
            </svg>
          </button>
          <button onClick={() => handleAlignment(RowFlex.ALIGNMENT)} title="Justify" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <select 
            onChange={(e) => handleTitle(e.target.value as TitleLevel | null)}
            className="toolbar-select"
            defaultValue=""
          >
            <option value="">Normal Text</option>
            <option value="first">Heading 1</option>
            <option value="second">Heading 2</option>
            <option value="third">Heading 3</option>
            <option value="fourth">Heading 4</option>
            <option value="fifth">Heading 5</option>
            <option value="sixth">Heading 6</option>
          </select>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={() => handleInsertList(ListType.UL, ListStyle.DISC)} title="Bullet List" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
            </svg>
          </button>
          <button onClick={() => handleInsertList(ListType.OL, ListStyle.DECIMAL)} title="Numbered List" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={handleInsertTable} title="Insert Table" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z"/>
            </svg>
          </button>
          <button onClick={handleInsertImage} title="Insert Image" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>
          <button onClick={handleInsertSeparator} title="Insert Horizontal Line" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
          <button onClick={handleInsertPageBreak} title="Insert Page Break" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M4 11h16v2H4zm0 4h4v1h2v-1h2v1h2v-1h2v1h2v-1h2v-2H4v2zm0-8h16V5H4v2z"/>
            </svg>
          </button>
          <button onClick={handleInsertCheckbox} title="Insert Checkbox" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </button>
          <button onClick={handleInsertDate} title="Insert Date" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
          </button>
          <button onClick={handleInsertCodeBlock} title="Insert Code Block" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
            </svg>
          </button>
          <button onClick={handleInsertWatermark} title="Add Watermark" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M12 2l-5.5 9h11z M12 5.84L13.93 9h-3.87z M17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z M3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>
            </svg>
          </button>
          <button onClick={handleRemoveWatermark} title="Remove Watermark" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M21 5c0-1.1-.9-2-2-2H5.83L21 18.17V5zM2.81 2.81L1.39 4.22 3 5.83V19c0 1.1.9 2 2 2h13.17l1.61 1.61 1.41-1.41L2.81 2.81z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={handleSearch} title="Search (Ctrl+F)" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
          <button onClick={handlePrint} title="Print (Ctrl+P)" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button onClick={handlePageSetup} title="Page Setup" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
          </button>
          <button onClick={handleSetMargins} title="Set Margins" className="toolbar-btn">
            <svg className="toolbar-icon" viewBox="0 0 24 24">
              <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zm-8-2h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <select 
            value={currentMode}
            onChange={(e) => setCurrentMode(e.target.value as EditorMode)}
            className="toolbar-select"
          >
            <option value={EditorMode.EDIT}>Edit Mode</option>
            <option value={EditorMode.READONLY}>Read Only</option>
            <option value={EditorMode.FORM}>Form Mode</option>
            <option value={EditorMode.PRINT}>Print Mode</option>
            <option value={EditorMode.CLEAN}>Clean Mode</option>
          </select>
        </div>
      </div>
      <div ref={containerRef} className="editor-canvas" />
    </div>
  );
};

export default DocumentEditorCanvas;