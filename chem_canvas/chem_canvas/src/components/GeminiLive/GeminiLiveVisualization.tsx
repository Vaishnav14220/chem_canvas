import React, { useEffect, useRef } from 'react';
import { VisualizationState, KineticsParams, Molecule3DParams } from './types';
import GeminiLiveKineticsSimulation from './GeminiLiveKineticsSimulation';
import GeminiLiveMathDerivation from './GeminiLiveMathDerivation';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface GeminiLiveVisualizationProps {
  visualizationState: VisualizationState;
}

const GeminiLiveVisualization: React.FC<GeminiLiveVisualizationProps> = ({ visualizationState }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build MolView embed URL from SMILES or molecule name
  const getMolViewUrl = (params: Molecule3DParams | undefined): string => {
    if (!params) return '';
    
    if (params.smiles) {
      // Encode SMILES for URL
      const encodedSmiles = encodeURIComponent(params.smiles);
      return `https://embed.molview.org/v1/?smiles=${encodedSmiles}&mode=balls`;
    } else if (params.name) {
      // Search by name
      return `https://embed.molview.org/v1/?query=${encodeURIComponent(params.name)}&mode=balls`;
    }
    
    return '';
  };

  // Handle showing/hiding the iframe
  useEffect(() => {
    if (visualizationState.type === 'MOLECULE_3D' && iframeRef.current) {
      iframeRef.current.style.display = visualizationState.isActive ? 'block' : 'none';
    }
  }, [visualizationState.isActive, visualizationState.type]);

  if (!visualizationState.isActive) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/30 rounded-xl border border-slate-700/50">
        <div className="text-center text-slate-400">
          <p className="text-sm">Waiting for visualization...</p>
        </div>
      </div>
    );
  }

  if (visualizationState.type === 'KINETICS') {
    return (
      <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900/30 border border-slate-700/50">
        {visualizationState.kineticsParams && (
          <GeminiLiveKineticsSimulation params={visualizationState.kineticsParams} />
        )}
      </div>
    );
  }

  if (visualizationState.type === 'MOLECULE_3D') {
    const molViewUrl = getMolViewUrl(visualizationState.molecule3DParams);

    if (!molViewUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/30 rounded-xl border border-slate-700/50">
          <div className="text-center text-amber-400 flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <p className="text-sm">No molecule data provided</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900/30 border border-slate-700/50 relative">
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10 pointer-events-none">
          <Loader2 className="animate-spin text-molecule-teal" size={24} />
        </div>
        <iframe
          ref={iframeRef}
          src={molViewUrl}
          className="w-full h-full border-0"
          allow="fullscreen"
          style={{
            display: visualizationState.isActive ? 'block' : 'none'
          }}
        />
        {visualizationState.molecule3DParams?.name && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-transparent p-4 z-20">
            <p className="text-sm text-slate-200 font-medium">
              {visualizationState.molecule3DParams.name}
            </p>
            {visualizationState.molecule3DParams.iupacName && (
              <p className="text-xs text-slate-400 mt-1">
                IUPAC: {visualizationState.molecule3DParams.iupacName}
              </p>
            )}
            {visualizationState.molecule3DParams.smiles && (
              <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                SMILES: {visualizationState.molecule3DParams.smiles}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (visualizationState.type === 'MATH_DERIVATION') {
    if (!visualizationState.mathDerivationParams) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900/30 rounded-xl border border-slate-700/50">
          <div className="text-center text-amber-400 flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <p className="text-sm">No derivation data provided</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full rounded-xl overflow-hidden">
        <GeminiLiveMathDerivation params={visualizationState.mathDerivationParams} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/30 rounded-xl border border-slate-700/50">
      <div className="text-center text-slate-400">
        <p className="text-sm">No visualization active</p>
      </div>
    </div>
  );
};

export default GeminiLiveVisualization;
