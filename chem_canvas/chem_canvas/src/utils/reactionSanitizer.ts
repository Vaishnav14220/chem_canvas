const KEYWORD_PREFIX_REGEX = /^(?:product|products|reactant|reactants|agent|agents)+/i;
const KEYWORD_CLEANUP_REGEX = /(kekule(?:\.js)?|reactionwidget|interactivereactionviewer|unabletoparsereactionsmiles|originalerror|pleaseensurethe|smilesformatiscorrect)/gi;
// Use new RegExp to avoid issues with escaping forward slashes in regex literals vs linter rules
const NON_SMILES_CHARS_REGEX = new RegExp('[^A-Za-z0-9[\\]()@+\\-=#./\\\\>]', 'g');
const REACTION_CANDIDATE_REGEX = new RegExp('([A-Za-z0-9[\\]()@+\\-=#./\\\\]+(?:>[A-Za-z0-9[\\]()@+\\-=#./\\\\]+){1,2})', 'g');

/**
 * Attempts to extract a plausible reaction SMILES string from noisy input.
 * Strips common error prefixes/suffixes and returns null when nothing valid remains.
 */
export function sanitizeReactionSmilesInput(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  let working = raw.trim();
  if (!working) {
    return null;
  }

  // If the string looks like an error message with quotes, pull the quoted SMILES.
  const quotedMatch = working.match(/"([^"\n]*?>[^"\n]*?)"/);
  if (quotedMatch && quotedMatch[1]) {
    working = quotedMatch[1].trim();
  }

  if (!working.includes('>')) {
    return working.length ? working : null;
  }

  // Remove obvious prefixes/suffixes introduced by error messages.
  working = working.replace(KEYWORD_PREFIX_REGEX, '');
  working = working.replace(KEYWORD_CLEANUP_REGEX, '');

  // Try to locate a reaction-like substring, falling back to the whole string.
  const candidates = Array.from(working.matchAll(REACTION_CANDIDATE_REGEX), match => match[1] || match[0]);
  if (candidates.length > 0) {
    const ordered = candidates.filter(candidate => candidate.includes('>'));
    if (ordered.length > 0) {
      working = ordered[0];
    } else {
      working = candidates[0];
    }
  }

  // Remove characters unsupported by SMILES/reaction notation.
  working = working.replace(NON_SMILES_CHARS_REGEX, '');

  // Ensure "->" style arrows are normalized to reaction arrows.
  const arrowCount = (working.match(/>/g) || []).length;
  if (arrowCount === 1) {
    working = working.replace('>', '>>');
  }

  // Strip any lingering keyword prefixes after cleanup.
  working = working.replace(KEYWORD_PREFIX_REGEX, '');

  working = working.trim();
  return working.length && working.includes('>') ? working : null;
}

/**
 * Remove atom-mapping annotations like ":1" from a reaction SMILES string.
 * Keeps the original structure while dropping numeric labels that clutter drawings.
 */
export function stripAtomMappings(smiles: string | null | undefined): string {
  if (!smiles) {
    return '';
  }

  return smiles.replace(/:([0-9]+)/g, '');
}
