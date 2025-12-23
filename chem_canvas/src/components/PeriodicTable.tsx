import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface PeriodicTableProps {
  isOpen: boolean;
  onClose: () => void;
}

const PeriodicTable: React.FC<PeriodicTableProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">PubChem Periodic Table</h2>
            <p className="text-sm text-gray-600">Click on elements to view detailed properties from PubChem</p>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://pubchem.ncbi.nlm.nih.gov/periodic-table/#view=table" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={20} className="text-gray-600" />
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Close Periodic Table"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Iframe Container - PubChem Periodic Table */}
        <div className="flex-1 p-4">
          <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden relative">
            <iframe
              src="https://pubchem.ncbi.nlm.nih.gov/periodic-table/#view=table&embed=true"
              className="w-full h-full"
              title="PubChem Periodic Table"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              allow="fullscreen"
              style={{ 
                border: 'none',
                margin: 0,
                padding: 0,
                display: 'block'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <strong>Interactive Features:</strong> Click elements for atomic properties, electron configuration, and more
            </div>
            <div className="text-xs text-gray-500">
              Powered by PubChem
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodicTable;
