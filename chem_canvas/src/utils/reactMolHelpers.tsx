import React from 'react';
import { Mol, C, O, N, H } from 'react-mol';

export const stageMeta = [
  { key: 'reactant' as const, label: 'Reactants', colour: '#ec4899' },
  { key: 'agent' as const, label: 'Reagents & catalysts', colour: '#10b981' },
  { key: 'product' as const, label: 'Products', colour: '#2563eb' }
] as const;

export type StageKey = (typeof stageMeta)[number]['key'];

const ELEMENT_COMPONENTS: Record<string, React.ComponentType<any>> = {
  C,
  H,
  O,
  N
};

const FALLBACK_TOKENS = ['C', 'H', 'H', 'H'];

/**
 * Tokenizes a SMILES string into individual element symbols for react-mol rendering.
 */
export const tokenizeSmiles = (smiles?: string | null, limit = 8): string[] => {
  if (!smiles?.trim()) {
    return [...FALLBACK_TOKENS];
  }

  const matches = smiles.match(/[A-Z][a-z]?/g);
  if (!matches || matches.length === 0) {
    return [...FALLBACK_TOKENS];
  }

  return matches.slice(0, limit);
};

const hydrogenCountForElement = (symbol: string): number => {
  if (symbol === 'C') return 2;
  if (symbol === 'N') return 1;
  if (symbol === 'O') return 0;
  return 1;
};

/**
 * Builds a nested react-mol element tree from a token list.
 */
export const buildMolElement = (tokens: string[], depth = 0): React.ReactElement => {
  const [head, ...tail] = tokens;
  const ElementComponent = ELEMENT_COMPONENTS[head] ?? Mol;

  const children: React.ReactNode[] = [];

  if (tail.length > 0) {
    const nextElement = buildMolElement(tail, depth + 1);
    children.push(
      React.cloneElement(nextElement, {
        key: `chain-${depth}`,
        angle: depth % 2 === 0 ? 35 : -35
      })
    );
  } else {
    children.push(<H key={`terminal-h-${depth}`} angle={depth % 2 === 0 ? 30 : -30} />);
  }

  const hydrogenCount = hydrogenCountForElement(head);
  for (let i = 0; i < hydrogenCount; i += 1) {
    children.push(<H key={`side-h-${depth}-${i}`} angle={60 * i} />);
  }

  return <ElementComponent key={`atom-${depth}`}>{children}</ElementComponent>;
};

export { FALLBACK_TOKENS };
