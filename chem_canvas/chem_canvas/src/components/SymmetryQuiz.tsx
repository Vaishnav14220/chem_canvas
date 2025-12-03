import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface SymmetryQuizProps {
  onScriptChange: (script: string) => void;
}

interface CrystalStructure {
  name: string;
  description: string;
  smiles?: string;
  elements: string[];
  unitCell: string;
}

const structures: CrystalStructure[] = [
  { 
    name: 'NaCl (Rock Salt)', 
    description: 'Face-centered cubic structure',
    smiles: '[Na+].[Cl-]',
    elements: ['Mirror planes', 'C₄ rotation axes'], 
    unitCell: 'set unitcell {5.64 5.64 5.64 90 90 90}' 
  },
  { 
    name: 'Diamond', 
    description: 'Face-centered cubic carbon',
    smiles: 'C',
    elements: ['C₃ rotation axes', 'Mirror planes'], 
    unitCell: 'set unitcell {3.57 3.57 3.57 90 90 90}' 
  },
  { 
    name: 'Graphite', 
    description: 'Hexagonal layered structure',
    smiles: 'c1ccccc1',
    elements: ['C₆ rotation axis', 'Mirror planes'], 
    unitCell: 'set unitcell {2.46 2.46 6.71 90 90 120}' 
  },
  { 
    name: 'Ice (Ih)', 
    description: 'Hexagonal ice structure',
    smiles: 'O',
    elements: ['C₆ rotation axis', 'Mirror planes'], 
    unitCell: 'set unitcell {4.52 4.52 7.36 90 90 120}' 
  },
];

const symmetryElements = [
  { id: 'mirror', label: 'Mirror planes', color: 'yellow' },
  { id: 'C4', label: 'C₄ rotation axes', color: 'red' },
  { id: 'C3', label: 'C₃ rotation axes', color: 'green' },
  { id: 'C6', label: 'C₆ rotation axis', color: 'blue' },
];

const SymmetryQuiz: React.FC<SymmetryQuizProps> = ({ onScriptChange }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const loadStructure = (idx: number) => {
    const structure = structures[idx];
    setCurrentIdx(idx);
    setSelected([]);
    setFeedback('');
    setShowAnswer(false);
    
    if (structure.smiles) {
      onScriptChange(`load $${structure.smiles}; ${structure.unitCell}; unitcell on; axes on; set frank off; color cpk;`);
    }
  };

  useEffect(() => {
    loadStructure(0);
  }, []);

  const loadNext = () => {
    const nextIdx = (currentIdx + 1) % structures.length;
    loadStructure(nextIdx);
  };

  const loadRandom = () => {
    const randomIdx = Math.floor(Math.random() * structures.length);
    loadStructure(randomIdx);
  };

  const highlight = (type: string) => {
    const cmds: Record<string, string> = {
      mirror: `draw plane1 {0 0 0} {1 0 0} {0 1 0} color yellow translucent 0.5;`,
      C4: `draw axis1 {0 0 0} {0 0 1} length 3 color red width 0.1;`,
      C3: `draw axis2 {1 1 1} length 3 color green width 0.1;`,
      C6: `draw axis3 {0 0 1} length 4 color blue width 0.1;`,
    };
    onScriptChange(cmds[type] || '');
  };

  const removeHighlight = (type: string) => {
    const drawNames: Record<string, string> = {
      mirror: 'plane1',
      C4: 'axis1',
      C3: 'axis2',
      C6: 'axis3',
    };
    onScriptChange(`draw ${drawNames[type]} delete;`);
  };

  const checkAnswer = () => {
    const correct = structures[currentIdx].elements;
    const selectedLabels = selected.map(id => 
      symmetryElements.find(el => el.id === id)?.label || id
    );
    
    const isCorrect = correct.every(e => selectedLabels.includes(e)) && 
                      selectedLabels.every(e => correct.includes(e));
    
    setFeedback(isCorrect 
      ? 'Correct! Well done!' 
      : `Not quite. The correct symmetry elements are: ${correct.join(', ')}`
    );
    setShowAnswer(true);
  };

  const handleToggle = (elementId: string, checked: boolean) => {
    if (checked) {
      setSelected(prev => [...prev, elementId]);
      highlight(elementId);
    } else {
      setSelected(prev => prev.filter(x => x !== elementId));
      removeHighlight(elementId);
    }
  };

  const currentStructure = structures[currentIdx];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Crystal Symmetry Quiz
        </h3>
        <p className="text-purple-200 text-sm mb-2">
          {currentStructure.name} - {currentStructure.description}
        </p>
        <p className="text-purple-100 text-xs">
          Select all symmetry elements present in this crystal structure
        </p>
      </div>

      <div className="bg-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">
          Select Symmetry Elements:
        </h4>
        <div className="space-y-2">
          {symmetryElements.map(element => (
            <label
              key={element.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-600 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(element.id)}
                onChange={(e) => handleToggle(element.id, e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={showAnswer}
              />
              <span className="text-white text-sm flex-1">{element.label}</span>
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: element.color }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={checkAnswer}
          disabled={selected.length === 0 || showAnswer}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Check Answer
        </button>
        <button
          onClick={loadNext}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          Next Structure
        </button>
        <button
          onClick={loadRandom}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {feedback && (
        <div className={`rounded-lg p-4 ${
          feedback.includes('Correct') 
            ? 'bg-green-900/30 border border-green-500/50' 
            : 'bg-red-900/30 border border-red-500/50'
        }`}>
          <div className="flex items-start gap-2">
            {feedback.includes('Correct') ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm font-medium ${
              feedback.includes('Correct') ? 'text-green-100' : 'text-red-100'
            }`}>
              {feedback}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SymmetryQuiz;
