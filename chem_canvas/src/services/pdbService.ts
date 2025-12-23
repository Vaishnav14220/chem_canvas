// PDB (Protein Data Bank) API Service
// Documentation: https://www.rcsb.org/docs/programmatic-access/web-services-overview

const PDB_BASE_URL = 'https://search.rcsb.org/rcsbsearch/v2/query';
const PDB_DATA_URL = 'https://files.rcsb.org/download';
const ALPHAFOLD_DATA_URL = 'https://alphafold.ebi.ac.uk/files';
const PDBE_ENTRY_FILES_BASE = 'https://www.ebi.ac.uk/pdbe/entry-files';

export interface PDBProteinData {
  entryId: string;
  title: string;
  description: string;
  organism: string;
  resolution?: number;
  method: string;
  depositionDate: string;
  pdbUrl: string;
  cifUrl: string;
  mmcifUrl: string;
  pdbData?: string;
  cifData?: string;
  displayName: string;
  source: 'pdb';
  type: 'protein';
  jsmolScript?: string;
  interactionSummary?: string;
  structureFormat?: 'pdb' | 'cif';
}

export const searchPDBProteins = async (
  query: string,
  maxResults = 12
): Promise<PDBProteinData[]> => {
  const searchQuery = {
    query: {
      type: 'terminal',
      service: 'full_text',
      parameters: {
        value: query
      }
    },
    request_options: {
      results_content_type: ['computational', 'experimental'],
      sort: [
        {
          sort_by: 'score',
          direction: 'desc'
        }
      ],
      paginate: {
        start: 0,
        rows: Math.min(maxResults, 50)
      }
    },
    return_type: 'entry'
  };

  try {
    const response = await fetch(PDB_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchQuery)
    });

    if (!response.ok) {
      throw new Error(`PDB search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.result_set || [];

    // Process results
    const proteins: PDBProteinData[] = [];

    for (const result of results.slice(0, maxResults)) {
      const entryId = result.identifier?.toLowerCase();

      if (!entryId) continue;

      // Get detailed information for each entry
      try {
        const detailResponse = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${entryId}`);
        if (!detailResponse.ok) continue;

        const detailData = await detailResponse.json();

        const protein: PDBProteinData = {
          entryId: entryId.toUpperCase(),
          title: detailData.struct?.title || detailData.struct?.pdbx_descriptor || `PDB ${entryId.toUpperCase()}`,
          description: detailData.struct?.pdbx_descriptor || '',
          organism: detailData.struct?.pdbx_descriptor || 'Unknown',
          resolution: detailData.rcsb_entry_info?.resolution_combined?.[0],
          method: detailData.exptl?.[0]?.method || 'Unknown',
          depositionDate: detailData.rcsb_accession_info?.deposit_date || '',
          pdbUrl: `${PDB_DATA_URL}/${entryId}.pdb`,
          cifUrl: `${PDBE_ENTRY_FILES_BASE}/${entryId.toLowerCase()}.cif`,
          mmcifUrl: `${PDBE_ENTRY_FILES_BASE}/${entryId.toLowerCase()}.cif`,
          displayName: detailData.struct?.title || `PDB ${entryId.toUpperCase()}`,
          source: 'pdb',
          type: 'protein',
          jsmolScript: `load "${PDB_DATA_URL}/${entryId}.pdb"; cartoon only; color structure; spin y 2;`
        };

        proteins.push(protein);
      } catch (detailError) {
        console.warn(`Failed to get details for PDB ${entryId}:`, detailError);
        // Add basic entry if details fail
        const basicProtein: PDBProteinData = {
          entryId: entryId.toUpperCase(),
          title: `PDB ${entryId.toUpperCase()}`,
          description: '',
          organism: 'Unknown',
          method: 'Unknown',
          depositionDate: '',
          pdbUrl: `${PDB_DATA_URL}/${entryId}.pdb`,
          cifUrl: `${PDBE_ENTRY_FILES_BASE}/${entryId.toLowerCase()}.cif`,
          mmcifUrl: `${PDBE_ENTRY_FILES_BASE}/${entryId.toLowerCase()}.cif`,
          displayName: `PDB ${entryId.toUpperCase()}`,
          source: 'pdb',
          type: 'protein',
          jsmolScript: `load "${PDB_DATA_URL}/${entryId}.pdb"; cartoon only; color structure; spin y 2;`
        };
        proteins.push(basicProtein);
      }
    }

    return proteins;
  } catch (error) {
    console.error('PDB search error:', error);
    return [];
  }
};

const normalizeAlphaFoldId = (pdbId: string): string => {
  let normalized = pdbId.trim().toUpperCase();

  if (normalized.startsWith('AF_')) {
    normalized = `AF-${normalized.slice(3)}`;
  } else if (normalized.startsWith('AF') && normalized[2] !== '-') {
    normalized = `AF-${normalized.slice(2)}`;
  }

  const hasIsoformSuffix = /-F\d+$/i.test(normalized);
  if (!hasIsoformSuffix) {
    const trailingIsoform = normalized.match(/F\d+$/i)?.[0];
    if (trailingIsoform) {
      normalized = `${normalized.slice(0, -trailingIsoform.length)}-${trailingIsoform.toUpperCase()}`;
    } else {
      normalized = `${normalized}-F1`;
    }
  }

  return normalized.toUpperCase();
};

const buildAlphaFoldUrl = (pdbId: string, format: 'pdb' | 'cif') => {
  const normalized = normalizeAlphaFoldId(pdbId);
  const extension = format === 'pdb' ? 'pdb' : 'cif';
  return `${ALPHAFOLD_DATA_URL}/${normalized}-model_v4.${extension}`;
};

export interface FetchedStructureData {
  data: string;
  format: 'pdb' | 'cif';
}

export const fetchPDBStructure = async (
  pdbId: string,
  preferredFormat: 'pdb' | 'cif' = 'pdb'
): Promise<FetchedStructureData | null> => {
  const trimmedId = pdbId.trim();
  if (!trimmedId) {
    return null;
  }

  const normalizedId = trimmedId.toUpperCase();
  const candidateSources: Array<{ url: string; format: 'pdb' | 'cif' }> = [];
  const lowerId = normalizedId.toLowerCase();

  if (/^AF[-_]?/i.test(normalizedId)) {
    candidateSources.push({ url: buildAlphaFoldUrl(normalizedId, preferredFormat), format: preferredFormat });
  }

  if (preferredFormat === 'pdb') {
    candidateSources.push(
      { url: `${PDBE_ENTRY_FILES_BASE}/pdb${lowerId}.ent`, format: 'pdb' },
      { url: `${PDB_DATA_URL}/${normalizedId}.pdb`, format: 'pdb' }
    );
    candidateSources.push(
      { url: `${PDBE_ENTRY_FILES_BASE}/${lowerId}.cif`, format: 'cif' },
      { url: `${PDB_DATA_URL}/${normalizedId}.cif`, format: 'cif' }
    );
  } else {
    candidateSources.push(
      { url: `${PDBE_ENTRY_FILES_BASE}/${lowerId}.cif`, format: 'cif' },
      { url: `${PDB_DATA_URL}/${normalizedId}.cif`, format: 'cif' },
      { url: `${PDBE_ENTRY_FILES_BASE}/pdb${lowerId}.ent`, format: 'pdb' },
      { url: `${PDB_DATA_URL}/${normalizedId}.pdb`, format: 'pdb' }
    );
  }

  for (const { url, format } of candidateSources) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        return { data: text, format };
      }
      console.warn(`Failed to fetch PDB structure from ${url}: ${response.status}`);
    } catch (error) {
      console.warn(`Error fetching PDB structure from ${url}:`, error);
    }
  }

  console.error(`Error fetching PDB structure ${normalizedId}: all sources failed.`);
  return null;
};

export const getPDBViewerUrl = (pdbId: string): string => {
  return `https://www.rcsb.org/3d-view/${pdbId.toUpperCase()}`;
};

export const getPDBEntryUrl = (pdbId: string): string => {
  return `https://www.rcsb.org/structure/${pdbId.toUpperCase()}`;
};
