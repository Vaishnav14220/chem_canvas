import React from 'react';
import MoleculeStructure from './MoleculeStructure';
import type { ReactionComponentDetails, ReactionResolutionResult } from '../services/reactionResolver';

type ReactionDiagramProps = {
  resolution: ReactionResolutionResult | null;
  fallbackSvg?: string | null;
};

const CARD_WIDTH = 200;
const CARD_HEIGHT = 180;

const ROLE_LABELS: Record<ReactionComponentDetails['role'], string> = {
  reactant: 'Reactants',
  agent: 'Reagents / Catalysts',
  product: 'Products'
};

const ROLE_COLOURS: Record<ReactionComponentDetails['role'], string> = {
  reactant: '#ec4899',
  agent: '#10b981',
  product: '#2563eb'
};

const ROLE_ORDER: ReactionComponentDetails['role'][] = ['reactant', 'agent', 'product'];

const ReactionDiagram: React.FC<ReactionDiagramProps> = ({ resolution, fallbackSvg }) => {
  const hasStructuredView = Boolean(
    resolution?.components?.some(component => typeof component.smiles === 'string' && component.smiles.trim().length > 0)
  );

  if (!resolution || !hasStructuredView) {
    if (!fallbackSvg) {
      return (
        <div className="flex h-[220px] w-full items-center justify-center rounded-lg border border-slate-200/40 bg-slate-100/20 text-sm text-slate-500">
          Unable to render reaction overview.
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div
          className="max-w-full overflow-auto rounded-lg border border-slate-200/60 bg-white p-4 shadow"
          dangerouslySetInnerHTML={{ __html: fallbackSvg }}
        />
      </div>
    );
  }

  const grouped = ROLE_ORDER.map(role => ({
    role,
    items: resolution.components.filter(component => component.role === role && component.smiles?.trim())
  })).filter(group => group.items.length > 0);

  const renderColumn = (role: ReactionComponentDetails['role'], items: ReactionComponentDetails[]) => (
    <div key={role} className="flex min-w-[220px] flex-col items-center gap-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ROLE_LABELS[role]}</div>
      <div className="flex flex-col items-center gap-4">
        {items.map((component, index) => (
          <MoleculeStructure
            key={`${role}-${index}-${component.smiles}`}
            structure={component.smiles as string}
            legend={component.label ?? component.original ?? component.smiles ?? ''}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            highlightColour={ROLE_COLOURS[role]}
            className="bg-white"
          />
        ))}
      </div>
    </div>
  );

  const reactants = grouped.find(group => group.role === 'reactant')?.items ?? [];
  const agents = grouped.find(group => group.role === 'agent')?.items ?? [];
  const products = grouped.find(group => group.role === 'product')?.items ?? [];

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full flex-col gap-6 rounded-xl border border-slate-200/50 bg-white p-6 shadow-sm">
        <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          {renderColumn('reactant', reactants)}

          <div className="flex min-w-[200px] flex-col items-center gap-4">
            <svg width="160" height="60" viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg">
              <line x1="8" y1="30" x2="140" y2="30" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
              <polygon points="140,18 140,42 152,30" fill="#1f2937" />
            </svg>
            {agents.length > 0 && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {ROLE_LABELS.agent}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {agents.map((component, index) => (
                    <MoleculeStructure
                      key={`agent-${index}-${component.smiles}`}
                      structure={component.smiles as string}
                      legend={component.label ?? component.original ?? component.smiles ?? ''}
                      width={CARD_WIDTH - 20}
                      height={CARD_HEIGHT - 40}
                      highlightColour={ROLE_COLOURS.agent}
                      className="bg-white"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {renderColumn('product', products)}
        </div>
      </div>
    </div>
  );
};

export default ReactionDiagram;
