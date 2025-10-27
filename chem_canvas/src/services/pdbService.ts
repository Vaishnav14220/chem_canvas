// PDB (Protein Data Bank) API Service
// Documentation: https://www.rcsb.org/docs/programmatic-access/web-services-overview

const PDB_BASE_URL = 'https://search.rcsb.org/rcsbsearch/v2/query';
const PDB_DATA_URL = 'https://files.rcsb.org/download';

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
          cifUrl: `${PDB_DATA_URL}/${entryId}.cif`,
          mmcifUrl: `${PDB_DATA_URL}/${entryId}.cif`,
          displayName: detailData.struct?.title || `PDB ${entryId.toUpperCase()}`,
          source: 'pdb',
          type: 'protein'
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
          cifUrl: `${PDB_DATA_URL}/${entryId}.cif`,
          mmcifUrl: `${PDB_DATA_URL}/${entryId}.cif`,
          displayName: `PDB ${entryId.toUpperCase()}`,
          source: 'pdb',
          type: 'protein'
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

export const fetchPDBStructure = async (pdbId: string, format: 'pdb' | 'cif' = 'pdb'): Promise<string | null> => {
  const url = format === 'pdb'
    ? `${PDB_DATA_URL}/${pdbId}.pdb`
    : `${PDB_DATA_URL}/${pdbId}.cif`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDB structure: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching PDB structure ${pdbId}:`, error);
    return null;
  }
};

export const getPDBViewerUrl = (pdbId: string): string => {
  return `https://www.rcsb.org/3d-view/${pdbId.toUpperCase()}`;
};

export const getPDBEntryUrl = (pdbId: string): string => {
  return `https://www.rcsb.org/structure/${pdbId.toUpperCase()}`;
};