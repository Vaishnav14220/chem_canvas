import React, { useState } from 'react';
import DocumentEditorCanvas from './DocumentEditorCanvas';
import { EditorMode, IElement } from '@hufe921/canvas-editor';

const DocumentEditorExample: React.FC = () => {
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [savedContent, setSavedContent] = useState<IElement[] | null>(null);
  const [mode, setMode] = useState(EditorMode.EDIT);

  const handleEditorReady = (editor: any) => {
    setEditorInstance(editor);
    console.log('Editor is ready!', editor);
  };

  const handleContentChange = (content: IElement[]) => {
    console.log('Content changed:', content);
  };

  const handleSave = () => {
    if (editorInstance?.command) {
      const value = editorInstance.command.getValue();
      setSavedContent(value.main);
      alert('Document saved successfully!');
      console.log('Saved content:', value.main);
    }
  };

  const handleLoad = () => {
    if (savedContent && editorInstance?.command) {
      editorInstance.command.setValue({
        header: [],
        main: savedContent,
        footer: [],
      });
      alert('Document loaded successfully!');
    }
  };

  const handleExport = () => {
    if (editorInstance?.command) {
      const value = editorInstance.command.getValue();
      const jsonContent = JSON.stringify(value, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          try {
            const content = JSON.parse(event.target.result);
            if (editorInstance?.command) {
              editorInstance.command.setValue(content);
              alert('Document imported successfully!');
            }
          } catch (error) {
            alert('Failed to import document. Please check the file format.');
            console.error('Import error:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClear = () => {
    if (editorInstance?.command) {
      editorInstance.command.setValue({
        header: [],
        main: [{
          value: '',
        }],
        footer: [],
      });
    }
  };

  const sampleDocuments = {
    report: [
      {
        value: 'Chemistry Lab Report',
        size: 24,
        bold: true,
        rowFlex: 'center' as const,
      },
      { value: '\n' },
      {
        value: 'Experiment: Synthesis of Aspirin',
        size: 18,
        bold: true,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Objective',
        size: 16,
        bold: true,
      },
      { value: '\n' },
      {
        value: 'To synthesize aspirin (acetylsalicylic acid) from salicylic acid and acetic anhydride, and to purify the product through recrystallization.',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Materials',
        size: 16,
        bold: true,
      },
      { value: '\n' },
      { value: '• Salicylic acid (2.0 g)', size: 14 },
      { value: '\n' },
      { value: '• Acetic anhydride (5.0 mL)', size: 14 },
      { value: '\n' },
      { value: '• Concentrated sulfuric acid (5 drops)', size: 14 },
      { value: '\n' },
      { value: '• Distilled water', size: 14 },
      { value: '\n' },
      { value: '• Ice bath', size: 14 },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Procedure',
        size: 16,
        bold: true,
      },
      { value: '\n' },
      {
        value: '1. Weigh 2.0 g of salicylic acid and place it in a 125 mL Erlenmeyer flask.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '2. Add 5.0 mL of acetic anhydride to the flask.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '3. Add 5 drops of concentrated sulfuric acid as a catalyst.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '4. Heat the mixture in a water bath at 50-60°C for 15 minutes.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '5. Remove from heat and add 20 mL of ice-cold water to decompose excess acetic anhydride.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '6. Cool the mixture in an ice bath until crystals form.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '7. Filter the crystals using vacuum filtration.',
        size: 14,
      },
      { value: '\n' },
      {
        value: '8. Recrystallize the product from hot water.',
        size: 14,
      },
    ],
    notes: [
      {
        value: 'Organic Chemistry - Class Notes',
        size: 20,
        bold: true,
        color: '#1e40af',
      },
      { value: '\n' },
      {
        value: 'Topic: Reaction Mechanisms',
        size: 16,
        bold: true,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'SN1 vs SN2 Reactions',
        size: 14,
        bold: true,
        underline: true,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'SN2 Mechanism:',
        size: 14,
        bold: true,
      },
      { value: '\n' },
      {
        value: '• Concerted mechanism - happens in one step',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Backside attack by nucleophile',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Inversion of stereochemistry',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Rate = k[substrate][nucleophile]',
        size: 12,
        italic: true,
      },
      { value: '\n' },
      {
        value: '• Favored by: primary substrates, strong nucleophiles, polar aprotic solvents',
        size: 12,
        highlight: '#ffeb3b',
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'SN1 Mechanism:',
        size: 14,
        bold: true,
      },
      { value: '\n' },
      {
        value: '• Two-step mechanism',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Carbocation intermediate formation',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Racemization possible',
        size: 12,
      },
      { value: '\n' },
      {
        value: '• Rate = k[substrate]',
        size: 12,
        italic: true,
      },
      { value: '\n' },
      {
        value: '• Favored by: tertiary substrates, weak nucleophiles, polar protic solvents',
        size: 12,
        highlight: '#ffeb3b',
      },
    ],
    letter: [
      {
        value: 'University of Chemistry',
        size: 16,
        rowFlex: 'right' as const,
      },
      { value: '\n' },
      {
        value: 'Department of Organic Chemistry',
        size: 14,
        rowFlex: 'right' as const,
      },
      { value: '\n' },
      {
        value: 'December 15, 2024',
        size: 12,
        rowFlex: 'right' as const,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Dear Professor Smith,',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'I am writing to express my interest in joining your research group for the upcoming summer internship program. As a third-year chemistry major with a strong passion for organic synthesis, I am particularly intrigued by your work on novel catalytic systems for asymmetric synthesis.',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Throughout my academic journey, I have maintained a GPA of 3.8 and have completed advanced courses in organic chemistry, physical chemistry, and spectroscopy. I have also gained practical laboratory experience through my work as a teaching assistant in the organic chemistry lab.',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'I am particularly interested in your recent publication on palladium-catalyzed cross-coupling reactions, which I found both innovative and inspiring. I believe that working in your lab would provide me with valuable research experience and help me develop the skills necessary for a career in chemical research.',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Thank you for considering my application. I would be honored to discuss this opportunity with you further.',
        size: 14,
      },
      { value: '\n' },
      { value: '\n' },
      {
        value: 'Sincerely,',
        size: 14,
      },
      { value: '\n' },
      {
        value: 'John Doe',
        size: 14,
      },
    ],
  };

  const loadSampleDocument = (type: keyof typeof sampleDocuments) => {
    if (editorInstance?.command) {
      editorInstance.command.setValue({
        header: [],
        main: sampleDocuments[type],
        footer: [],
      });
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f0f0f0', 
        borderBottom: '1px solid #ddd',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <h2 style={{ margin: 0, marginRight: 'auto', color: '#333' }}>
          Document Editor Demo
        </h2>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSave} style={buttonStyle}>
            💾 Save
          </button>
          <button onClick={handleLoad} style={buttonStyle} disabled={!savedContent}>
            📁 Load
          </button>
          <button onClick={handleExport} style={buttonStyle}>
            ⬇️ Export
          </button>
          <button onClick={handleImport} style={buttonStyle}>
            ⬆️ Import
          </button>
          <button onClick={handleClear} style={buttonStyle}>
            🗑️ Clear
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => loadSampleDocument('report')} style={sampleButtonStyle}>
            📝 Lab Report
          </button>
          <button onClick={() => loadSampleDocument('notes')} style={sampleButtonStyle}>
            📚 Class Notes
          </button>
          <button onClick={() => loadSampleDocument('letter')} style={sampleButtonStyle}>
            ✉️ Letter
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DocumentEditorCanvas
          onReady={handleEditorReady}
          mode={mode}
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'background-color 0.3s',
};

const sampleButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#2196F3',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'background-color 0.3s',
};

export default DocumentEditorExample;
