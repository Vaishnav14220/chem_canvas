import type { MoleculeData, CrystalVisualData } from './pubchemService';

const COD_SEARCH_ENDPOINT = 'https://www.crystallography.net/cod/result';
const COD_DOWNLOAD_BASE = 'https://www.crystallography.net/cod';
const COD_PROXY_PREFIX = 'https://corsproxy.io/?';

const MOLVIEW_BASE = 'https://molview.org/php';
const MOLVIEW_SEARCH_ENDPOINT = `${MOLVIEW_BASE}/cod.php`;
const MOLVIEW_CIF_ENDPOINT = `${MOLVIEW_BASE}/cif.php`;

interface CIFCellParameters {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface CIFAtom {
  label: string;
  element: string;
  fractX: number;
  fractY: number;
  fractZ: number;
  occupancy?: number;
}

interface CIFStructure {
  name: string;
  formula: string;
  cell: CIFCellParameters;
  atoms: CIFAtom[];
  bonds: Array<{ label1: string; label2: string; distance?: number }>;
}

export interface MineralSearchResult {
  codId: string;
  mineralName: string;
  formula: string;
  spaceGroup?: string;
  hallSymbol?: string;
}

const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.0079,
  He: 4.0026,
  Li: 6.941,
  Be: 9.0122,
  B: 10.811,
  C: 12.0107,
  N: 14.0067,
  O: 15.9994,
  F: 18.9984,
  Ne: 20.1797,
  Na: 22.9897,
  Mg: 24.305,
  Al: 26.9815,
  Si: 28.0855,
  P: 30.9738,
  S: 32.065,
  Cl: 35.453,
  K: 39.0983,
  Ca: 40.078,
  Ti: 47.867,
  V: 50.9415,
  Cr: 51.9961,
  Mn: 54.938,
  Fe: 55.845,
  Co: 58.9332,
  Ni: 58.6934,
  Cu: 63.546,
  Zn: 65.38,
  Ga: 69.723,
  Ge: 72.64,
  As: 74.9216,
  Se: 78.96,
  Br: 79.904,
  Rb: 85.4678,
  Sr: 87.62,
  Y: 88.9059,
  Zr: 91.224,
  Nb: 92.9064,
  Mo: 95.94,
  Ag: 107.8682,
  Cd: 112.411,
  In: 114.818,
  Sn: 118.71,
  Sb: 121.76,
  Te: 127.6,
  I: 126.9045,
  Cs: 132.9055,
  Ba: 137.327,
  La: 138.9055,
  Ce: 140.116,
  W: 183.84,
  Pt: 195.084,
  Au: 196.9665,
  Hg: 200.59,
  Pb: 207.2,
};

const COVALENT_RADII: Record<string, number> = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Si: 1.11,
  Al: 1.21,
  Mg: 1.3,
  Ca: 1.74,
  Na: 1.66,
  K: 2.03,
  Fe: 1.24,
  Cu: 1.32,
  Zn: 1.22,
  Ti: 1.36,
  Mn: 1.39,
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit | undefined = undefined,
  retries = 3
): Promise<Response | null> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }

      if (response.status === 429 && attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      if (attempt === retries - 1) {
        return response;
      }
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  return null;
};

const tokenizeCIFRow = (line: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuote && (char === "'" || char === '"')) {
      inQuote = true;
      quoteChar = char;
      continue;
    }

    if (inQuote && char === quoteChar) {
      inQuote = false;
      tokens.push(current.trim());
      current = '';
      continue;
    }

    if (!inQuote && /\s/.test(char)) {
      if (current.trim().length > 0) {
        tokens.push(current.trim());
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }

  return tokens;
};

const parseNumberSafe = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const cleaned = value.replace(/[()]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCIF = (cifText: string): CIFStructure | null => {
  const lines = cifText.replace(/\r\n?/g, '\n').split('\n');

  const cell: CIFCellParameters = {
    a: 1,
    b: 1,
    c: 1,
    alpha: 90,
    beta: 90,
    gamma: 90,
  };

  const atoms: CIFAtom[] = [];
  const pendingBonds: Array<{ label1: string; label2: string; distance?: number }> = [];

  let chemicalName = '';
  let chemicalFormula = '';

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_length_a')) {
      const value = trimmed.replace('_cell_length_a', '').trim();
      cell.a = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_length_b')) {
      const value = trimmed.replace('_cell_length_b', '').trim();
      cell.b = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_length_c')) {
      const value = trimmed.replace('_cell_length_c', '').trim();
      cell.c = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_angle_alpha')) {
      const value = trimmed.replace('_cell_angle_alpha', '').trim();
      cell.alpha = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_angle_beta')) {
      const value = trimmed.replace('_cell_angle_beta', '').trim();
      cell.beta = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_cell_angle_gamma')) {
      const value = trimmed.replace('_cell_angle_gamma', '').trim();
      cell.gamma = parseNumberSafe(value);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_chemical_name_mineral')) {
      const value = trimmed.replace('_chemical_name_mineral', '').trim();
      const tokens = tokenizeCIFRow(value);
      chemicalName = tokens[0] ?? chemicalName;
      index += 1;
      continue;
    }

    if (trimmed.startsWith('_chemical_formula_sum')) {
      const value = trimmed.replace('_chemical_formula_sum', '').trim();
      const tokens = tokenizeCIFRow(value);
      chemicalFormula = tokens[0]?.replace(/'/g, '') ?? chemicalFormula;
      index += 1;
      continue;
    }

    if (trimmed.startsWith('loop_')) {
      index += 1;
      const headers: string[] = [];

      while (index < lines.length) {
        const headerLine = lines[index].trim();
        if (headerLine.startsWith('_')) {
          headers.push(headerLine);
          index += 1;
          continue;
        }
        break;
      }

      const rows: string[] = [];
      while (index < lines.length) {
        const valueLine = lines[index];
        const valueTrimmed = valueLine.trim();
        if (!valueTrimmed) {
          index += 1;
          continue;
        }
        if (valueTrimmed.startsWith('_') || valueTrimmed.startsWith('loop_')) {
          break;
        }
        rows.push(valueLine);
        index += 1;
      }

      const headerMap = new Map<string, number>();
      headers.forEach((header, idx) => {
        headerMap.set(header, idx);
      });

      if (
        headerMap.has('_atom_site_fract_x') &&
        headerMap.has('_atom_site_fract_y') &&
        headerMap.has('_atom_site_fract_z')
      ) {
        rows.forEach((row) => {
          const tokens = tokenizeCIFRow(row);
          const elementSymbol = headerMap.has('_atom_site_type_symbol')
            ? tokens[headerMap.get('_atom_site_type_symbol') ?? -1]
            : headerMap.has('_atom_site_label')
              ? tokens[headerMap.get('_atom_site_label') ?? -1]
              : 'X';

          const label = headerMap.has('_atom_site_label')
            ? tokens[headerMap.get('_atom_site_label') ?? -1]
            : elementSymbol;

          const atom: CIFAtom = {
            label: label ?? elementSymbol ?? 'X',
            element: (elementSymbol || 'X').replace(/[^A-Za-z]/g, ''),
            fractX: parseNumberSafe(tokens[headerMap.get('_atom_site_fract_x') ?? -1]),
            fractY: parseNumberSafe(tokens[headerMap.get('_atom_site_fract_y') ?? -1]),
            fractZ: parseNumberSafe(tokens[headerMap.get('_atom_site_fract_z') ?? -1]),
            occupancy: headerMap.has('_atom_site_occupancy')
              ? parseNumberSafe(tokens[headerMap.get('_atom_site_occupancy') ?? -1])
              : undefined,
          };

          if (
            Number.isFinite(atom.fractX) &&
            Number.isFinite(atom.fractY) &&
            Number.isFinite(atom.fractZ)
          ) {
            atoms.push(atom);
          }
        });
        continue;
      }

      if (
        headerMap.has('_geom_bond_atom_site_label_1') &&
        headerMap.has('_geom_bond_atom_site_label_2')
      ) {
        rows.forEach((row) => {
          const tokens = tokenizeCIFRow(row);
          const label1 = tokens[headerMap.get('_geom_bond_atom_site_label_1') ?? -1];
          const label2 = tokens[headerMap.get('_geom_bond_atom_site_label_2') ?? -1];
          const distance = headerMap.has('_geom_bond_distance')
            ? parseNumberSafe(tokens[headerMap.get('_geom_bond_distance') ?? -1])
            : undefined;

          if (label1 && label2) {
            pendingBonds.push({ label1, label2, distance });
          }
        });
        continue;
      }

      continue;
    }

    index += 1;
  }

  if (atoms.length === 0) {
    return null;
  }

  return {
    name: chemicalName,
    formula: chemicalFormula,
    cell,
    atoms,
    bonds: pendingBonds,
  };
};

type CellBasisVectors = {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
};

const computeCellBasisVectors = (cell: CIFCellParameters): CellBasisVectors => {
  const alpha = (cell.alpha * Math.PI) / 180;
  const beta = (cell.beta * Math.PI) / 180;
  const gamma = (cell.gamma * Math.PI) / 180;

  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);
  const sinGamma = Math.sin(gamma) || 1e-6;

  const vectorA: [number, number, number] = [cell.a, 0, 0];
  const vectorB: [number, number, number] = [cell.b * cosGamma, cell.b * sinGamma, 0];
  const cX = cell.c * cosBeta;
  const cY = cell.c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
  const cZ = Math.sqrt(Math.max(cell.c * cell.c - cX * cX - cY * cY, 0));
  const vectorC: [number, number, number] = [cX, cY, cZ];

  return {
    a: vectorA,
    b: vectorB,
    c: vectorC,
  };
};

const fractionalToCartesian = (atom: CIFAtom, basis: CellBasisVectors) => ({
  x: atom.fractX * basis.a[0] + atom.fractY * basis.b[0] + atom.fractZ * basis.c[0],
  y: atom.fractX * basis.a[1] + atom.fractY * basis.b[1] + atom.fractZ * basis.c[1],
  z: atom.fractX * basis.a[2] + atom.fractY * basis.b[2] + atom.fractZ * basis.c[2],
});

const centerCoordinates = (coords: Array<{ x: number; y: number; z: number }>) => {
  if (coords.length === 0) {
    return {
      coords,
      centroid: { x: 0, y: 0, z: 0 },
    };
  }

  const centroid = coords.reduce(
    (acc, value) => ({
      x: acc.x + value.x,
      y: acc.y + value.y,
      z: acc.z + value.z,
    }),
    { x: 0, y: 0, z: 0 }
  );

  centroid.x /= coords.length;
  centroid.y /= coords.length;
  centroid.z /= coords.length;

  const centered = coords.map((value) => ({
    x: value.x - centroid.x,
    y: value.y - centroid.y,
    z: value.z - centroid.z,
  }));

  return {
    coords: centered,
    centroid,
  };
};

const distance3D = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const getCovalentRadius = (element: string): number => COVALENT_RADII[element] ?? 1.2;

const generateBonds = (
  coords: Array<{ x: number; y: number; z: number }>,
  atoms: CIFAtom[],
  labelToIndex: Map<string, number>,
  pending: Array<{ label1: string; label2: string; distance?: number }>
) => {
  const bonds: Array<{ from: number; to: number }> = [];
  const seen = new Set<string>();

  pending.forEach(({ label1, label2 }) => {
    const from = labelToIndex.get(label1);
    const to = labelToIndex.get(label2);
    if (from === undefined || to === undefined || from === to) {
      return;
    }
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    bonds.push({ from, to });
  });

  if (bonds.length > 0) {
    return bonds;
  }

  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = distance3D(coords[i], coords[j]);
      const threshold = getCovalentRadius(atoms[i].element) + getCovalentRadius(atoms[j].element) + 0.35;
      if (dist > 0 && dist <= threshold) {
        const key = `${i}-${j}`;
        if (!seen.has(key)) {
          seen.add(key);
          bonds.push({ from: i, to: j });
        }
      }
    }
  }

  return bonds;
};

const formatCoordinate = (value: number) => value.toFixed(4).padStart(10, ' ');

const buildSDF = (
  atoms: CIFAtom[],
  coords: Array<{ x: number; y: number; z: number }>,
  bonds: Array<{ from: number; to: number }>,
  title: string
): string => {
  const lines: string[] = [];
  lines.push(title || 'Mineral Structure');
  lines.push('  ChemCanvasCOD');
  lines.push('  Imported from COD');

  const atomCount = atoms.length;
  const bondCount = bonds.length;
  const countsLine = `${atomCount.toString().padStart(3, ' ')}${bondCount
    .toString()
    .padStart(3, ' ')}  0  0  0  0  0  0  0  0  0999 V2000`;
  lines.push(countsLine);

  atoms.forEach((atom, index) => {
    const coord = coords[index];
    const element = (atom.element || 'X').toUpperCase().padEnd(3, ' ');
    const line = `${formatCoordinate(coord.x)}${formatCoordinate(coord.y)}${formatCoordinate(coord.z)} ${element} 0  0  0  0  0  0  0  0  0  0  0  0`;
    lines.push(line);
  });

  bonds.forEach((bond) => {
    const from = (bond.from + 1).toString().padStart(3, ' ');
    const to = (bond.to + 1).toString().padStart(3, ' ');
    lines.push(`${from}${to}  1  0  0  0  0`);
  });

  lines.push('M  END');
  lines.push('');
  return lines.join('\n');
};

const computeMolecularWeight = (atoms: CIFAtom[]) =>
  atoms.reduce((total, atom) => {
    const weight = ATOMIC_WEIGHTS[atom.element] ?? 0;
    return total + weight * (atom.occupancy ?? 1);
  }, 0);

const buildCrystalVisualData = (
  structure: CIFStructure,
  centeredCoords: Array<{ x: number; y: number; z: number }>,
  bonds: Array<{ from: number; to: number }>,
  centroid: { x: number; y: number; z: number },
  basis: CellBasisVectors
): CrystalVisualData => {
  const atoms = centeredCoords.map((coord, index) => ({
    element: structure.atoms[index]?.element ?? 'X',
    x: coord.x,
    y: coord.y,
    z: coord.z,
  }));

  const rawVertices = [
    { x: 0, y: 0, z: 0 },
    { x: basis.a[0], y: basis.a[1], z: basis.a[2] },
    { x: basis.b[0], y: basis.b[1], z: basis.b[2] },
    { x: basis.c[0], y: basis.c[1], z: basis.c[2] },
    {
      x: basis.a[0] + basis.b[0],
      y: basis.a[1] + basis.b[1],
      z: basis.a[2] + basis.b[2],
    },
    {
      x: basis.a[0] + basis.c[0],
      y: basis.a[1] + basis.c[1],
      z: basis.a[2] + basis.c[2],
    },
    {
      x: basis.b[0] + basis.c[0],
      y: basis.b[1] + basis.c[1],
      z: basis.b[2] + basis.c[2],
    },
    {
      x: basis.a[0] + basis.b[0] + basis.c[0],
      y: basis.a[1] + basis.b[1] + basis.c[1],
      z: basis.a[2] + basis.b[2] + basis.c[2],
    },
  ];

  const centeredVertices = rawVertices.map((vertex) => ({
    x: vertex.x - centroid.x,
    y: vertex.y - centroid.y,
    z: vertex.z - centroid.z,
  }));

  const cellEdges: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [2, 6],
    [3, 5],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ];

  return {
    atoms,
    bonds,
    cellVertices: centeredVertices,
    cellEdges,
  };
};

const createCrystalModel = (
  structure: CIFStructure,
  fallbackTitle: string
): {
  sdf: string;
  molecularWeight: number;
  crystalData: CrystalVisualData;
} | null => {
  const basis = computeCellBasisVectors(structure.cell);
  const cartesianRaw = structure.atoms.map((atom) => fractionalToCartesian(atom, basis));
  const { coords: centeredCoords, centroid } = centerCoordinates(cartesianRaw);

  const labelToIndex = new Map<string, number>();
  structure.atoms.forEach((atom, idx) => {
    labelToIndex.set(atom.label, idx);
  });

  const bonds = generateBonds(centeredCoords, structure.atoms, labelToIndex, structure.bonds);
  const title = structure.name || fallbackTitle;
  const sdf = buildSDF(structure.atoms, centeredCoords, bonds, title);
  const molecularWeight = computeMolecularWeight(structure.atoms);
  const crystalData = buildCrystalVisualData(structure, centeredCoords, bonds, centroid, basis);

  return {
    sdf,
    molecularWeight,
    crystalData,
  };
};

export const searchMinerals = async (
  query: string,
  maxResults = 12
): Promise<MineralSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const params = new URLSearchParams();
  params.set('format', 'json');
  params.set('limit', String(maxResults));

  const looksLikeId = /^\d{3,}$/.test(trimmed.replace(/[^0-9]/g, ''));
  if (looksLikeId && /^\d+$/.test(trimmed)) {
    params.set('id', trimmed);
  } else {
    params.set('text', trimmed);
  }

  const codUrl = `${COD_SEARCH_ENDPOINT}?${params.toString()}`;

  try {
    const molviewUrl = `${MOLVIEW_SEARCH_ENDPOINT}?q=${encodeURIComponent(trimmed)}`;
    const molviewProxiedUrl = `${COD_PROXY_PREFIX}${encodeURIComponent(molviewUrl)}`;
    const molviewResponse = await fetchWithRetry(molviewProxiedUrl);
    if (molviewResponse && molviewResponse.ok) {
      const molviewJson = await molviewResponse.json();
      const records: any[] = Array.isArray(molviewJson?.records) ? molviewJson.records : [];
      if (records.length > 0) {
        return records
          .map((entry) => {
            const codId = entry?.codid ?? entry?.cod_id ?? entry?.file;
            if (!codId) return null;
            return {
              codId: String(codId),
              mineralName:
                entry?.mineral ||
                entry?.title ||
                entry?.chemname ||
                `COD ${codId}`,
              formula: entry?.formula || '',
              spaceGroup: undefined,
              hallSymbol: undefined,
            } as MineralSearchResult;
          })
          .filter((item): item is MineralSearchResult => Boolean(item?.codId));
      }
    }
  } catch (error) {
    console.warn('MolView mineral search failed, falling back to COD:', error);
  }

  let response = await fetchWithRetry(codUrl);
  if ((!response || !response.ok) && !codUrl.startsWith(COD_PROXY_PREFIX)) {
    const proxiedUrl = `${COD_PROXY_PREFIX}${encodeURIComponent(codUrl)}`;
    console.warn('Mineral search falling back to COD proxy', proxiedUrl);
    response = await fetchWithRetry(proxiedUrl);
  }
  if (!response || !response.ok) {
    console.warn('Mineral search request failed', response?.status);
    return [];
  }

  try {
    const payloadText = await response.text();
    const payload = payloadText.trim().length > 0 ? JSON.parse(payloadText) : [];
    const rawResults: any[] = Array.isArray(payload) ? payload : [];

    return rawResults
      .map((entry) => {
        const codId = entry?.file ?? entry?.cod_id ?? entry?.id;
        if (!codId) {
          return null;
        }

        const mineralName =
          entry?.chemical_name_mineral ||
          entry?.mineral ||
          entry?.common_name ||
          entry?.title ||
          entry?.name ||
          `COD ${codId}`;

        const formula = entry?.formula || entry?.chemical_formula_sum || entry?.empirical_formula || '';
        const spaceGroup = entry?.spacegroup || entry?.space_group_name_h_m || entry?.space_group_symbol;
        const hallSymbol = entry?.space_group_hall;

        return {
          codId: String(codId),
          mineralName,
          formula,
          spaceGroup,
          hallSymbol,
        } as MineralSearchResult;
      })
      .filter((item): item is MineralSearchResult => Boolean(item));
  } catch (error) {
    console.warn('Failed to parse COD search response', error);
    return [];
  }
};

export const getMineralByCodId = async (codId: string): Promise<MoleculeData | null> => {
  const trimmed = codId.trim();
  if (!trimmed) {
    return null;
  }

  const fetchCifText = async (url: string): Promise<string | null> => {
    const response = await fetchWithRetry(url);
    if (!response || !response.ok) {
      return null;
    }
    return response.text();
  };

  const molviewCifUrl = `${COD_PROXY_PREFIX}${encodeURIComponent(
    `${MOLVIEW_CIF_ENDPOINT}?codid=${encodeURIComponent(trimmed)}`
  )}`;
  let cifText = await fetchCifText(molviewCifUrl);

  if (!cifText) {
    const cifUrl = `${COD_DOWNLOAD_BASE}/${encodeURIComponent(trimmed)}.cif`;
    const proxiedCifUrl = `${COD_PROXY_PREFIX}${encodeURIComponent(cifUrl)}`;
    cifText = await fetchCifText(proxiedCifUrl);
    if (!cifText) {
      console.warn('Failed to fetch CIF for COD ID', trimmed);
      return null;
    }
  }
  const structure = parseCIF(cifText);
  if (!structure) {
    return null;
  }

  const crystalModel = createCrystalModel(structure, `COD ${trimmed}`);
  if (!crystalModel) {
    return null;
  }

  const { sdf, molecularWeight, crystalData } = crystalModel;

  const numericId = Number.parseInt(trimmed.replace(/[^0-9]/g, ''), 10);

  const mineralData: MoleculeData = {
    name: structure.name || `COD ${trimmed}`,
    displayName: structure.name ? `${structure.name} (COD ${trimmed})` : `COD ${trimmed}`,
    cid: Number.isFinite(numericId) ? numericId : Date.now(),
    molecularFormula: structure.formula || 'Unknown',
    molecularWeight,
    svgUrl: '',
    svgData: undefined,
    smiles: '',
    sdfData: sdf,
    sdf3DData: sdf,
    source: 'cod',
    role: 'mineral',
    sourceQuery: trimmed,
    codId: trimmed,
    cifData: cifText,
    isCrystal: true,
    crystalData,
  };

  return mineralData;
};

export const buildCrystalVisualFromCif = (cifText: string): CrystalVisualData | null => {
  const structure = parseCIF(cifText);
  if (!structure) {
    return null;
  }

  const model = createCrystalModel(structure, structure.name || 'Crystal Structure');
  return model?.crystalData ?? null;
};
