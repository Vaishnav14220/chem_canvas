/**
 * Scholarly Service - Client for the Hugging Face Space Scholarly API
 * Provides access to Google Scholar data for citations, paper search, etc.
 */

// ==========================================
// Configuration
// ==========================================

// Update this URL after deploying your Hugging Face Space
const SCHOLARLY_API_URL = import.meta.env.VITE_SCHOLARLY_API_URL || 'https://your-username-scholarly-api.hf.space';

// Fallback to Semantic Scholar if Hugging Face Space is not available
const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';

// ==========================================
// Types
// ==========================================

export interface Author {
  name: string;
  affiliation?: string;
  scholarId?: string;
  citedBy?: number;
  interests?: string[];
}

export interface Publication {
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  venue?: string;
  citations?: number;
  url?: string;
  bibtex?: string;
  scholarUrl?: string;
  paperId?: string; // Semantic Scholar ID
  doi?: string;
}

export interface SearchResult {
  publications: Publication[];
  totalResults?: number;
  query: string;
}

export interface CitationResult {
  citingPapers: Publication[];
  totalCitations: number;
  originalTitle: string;
}

export interface SimilarPapersResult {
  similarPapers: Publication[];
  originalTitle: string;
}

// ==========================================
// API Status Check
// ==========================================

let isScholarlyApiAvailable: boolean | null = null;

/**
 * Check if the Scholarly API (Hugging Face Space) is available
 */
export const checkScholarlyApiStatus = async (): Promise<boolean> => {
  if (isScholarlyApiAvailable !== null) {
    return isScholarlyApiAvailable;
  }

  try {
    const response = await fetch(`${SCHOLARLY_API_URL}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    isScholarlyApiAvailable = response.ok;
    console.log(`✅ Scholarly API available: ${isScholarlyApiAvailable}`);
    return isScholarlyApiAvailable;
  } catch (error) {
    console.warn('⚠️ Scholarly API not available, will use Semantic Scholar fallback');
    isScholarlyApiAvailable = false;
    return false;
  }
};

// ==========================================
// Scholarly API (Hugging Face Space)
// ==========================================

/**
 * Search for publications using the Scholarly API
 */
const searchPublicationsScholarly = async (query: string, limit: number = 10): Promise<SearchResult> => {
  const response = await fetch(
    `${SCHOLARLY_API_URL}/search/publications?query=${encodeURIComponent(query)}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Scholarly API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    publications: data.publications.map((pub: any) => ({
      title: pub.title,
      authors: pub.authors || [],
      year: pub.year,
      abstract: pub.abstract,
      venue: pub.venue,
      citations: pub.citations,
      url: pub.url,
      bibtex: pub.bibtex,
      scholarUrl: pub.scholar_url
    })),
    totalResults: data.total_results,
    query: data.query
  };
};

/**
 * Get citations for a paper using the Scholarly API
 */
const getCitationsScholarly = async (title: string, limit: number = 20): Promise<CitationResult> => {
  const response = await fetch(
    `${SCHOLARLY_API_URL}/citations?title=${encodeURIComponent(title)}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Scholarly API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    citingPapers: data.citing_papers.map((pub: any) => ({
      title: pub.title,
      authors: pub.authors || [],
      year: pub.year,
      abstract: pub.abstract,
      venue: pub.venue,
      citations: pub.citations,
      url: pub.url
    })),
    totalCitations: data.total_citations,
    originalTitle: data.original_title
  };
};

/**
 * Get BibTeX citation using the Scholarly API
 */
const getBibtexScholarly = async (title: string): Promise<string> => {
  const response = await fetch(
    `${SCHOLARLY_API_URL}/bibtex?title=${encodeURIComponent(title)}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Scholarly API error: ${response.status}`);
  }

  const data = await response.json();
  return data.bibtex;
};

/**
 * Find similar papers using the Scholarly API
 */
const getSimilarPapersScholarly = async (title: string, limit: number = 10): Promise<SimilarPapersResult> => {
  const response = await fetch(
    `${SCHOLARLY_API_URL}/similar?title=${encodeURIComponent(title)}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Scholarly API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    similarPapers: data.similar_papers.map((pub: any) => ({
      title: pub.title,
      authors: pub.authors || [],
      year: pub.year,
      abstract: pub.abstract,
      venue: pub.venue,
      citations: pub.citations,
      url: pub.url
    })),
    originalTitle: data.original_title
  };
};

// ==========================================
// Semantic Scholar API (Fallback)
// ==========================================

/**
 * Search for publications using Semantic Scholar API
 */
const searchPublicationsSemanticScholar = async (query: string, limit: number = 10): Promise<SearchResult> => {
  const fields = 'title,authors,year,abstract,venue,citationCount,url,externalIds';
  const response = await fetch(
    `${SEMANTIC_SCHOLAR_API}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    publications: (data.data || []).map((paper: any) => ({
      title: paper.title,
      authors: (paper.authors || []).map((a: any) => a.name),
      year: paper.year,
      abstract: paper.abstract,
      venue: paper.venue,
      citations: paper.citationCount,
      url: paper.url,
      paperId: paper.paperId,
      doi: paper.externalIds?.DOI
    })),
    totalResults: data.total,
    query: query
  };
};

/**
 * Get citations for a paper using Semantic Scholar API
 */
const getCitationsSemanticScholar = async (title: string, limit: number = 20): Promise<CitationResult> => {
  // First, search for the paper to get its ID
  const searchResult = await searchPublicationsSemanticScholar(title, 1);
  if (searchResult.publications.length === 0) {
    throw new Error('Paper not found');
  }

  const paperId = searchResult.publications[0].paperId;
  if (!paperId) {
    throw new Error('Paper ID not found');
  }

  // Get citations
  const fields = 'title,authors,year,abstract,venue,citationCount,url';
  const response = await fetch(
    `${SEMANTIC_SCHOLAR_API}/paper/${paperId}/citations?fields=${fields}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    citingPapers: (data.data || []).map((item: any) => ({
      title: item.citingPaper?.title || '',
      authors: (item.citingPaper?.authors || []).map((a: any) => a.name),
      year: item.citingPaper?.year,
      abstract: item.citingPaper?.abstract,
      venue: item.citingPaper?.venue,
      citations: item.citingPaper?.citationCount,
      url: item.citingPaper?.url
    })),
    totalCitations: searchResult.publications[0].citations || 0,
    originalTitle: searchResult.publications[0].title
  };
};

/**
 * Get recommended/similar papers using Semantic Scholar API
 */
const getSimilarPapersSemanticScholar = async (title: string, limit: number = 10): Promise<SimilarPapersResult> => {
  // First, search for the paper to get its ID
  const searchResult = await searchPublicationsSemanticScholar(title, 1);
  if (searchResult.publications.length === 0) {
    throw new Error('Paper not found');
  }

  const paperId = searchResult.publications[0].paperId;
  if (!paperId) {
    throw new Error('Paper ID not found');
  }

  // Get recommendations
  const fields = 'title,authors,year,abstract,venue,citationCount,url';
  const response = await fetch(
    `${SEMANTIC_SCHOLAR_API}/recommendations/v1/papers/forpaper/${paperId}?fields=${fields}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    // Fall back to reference papers if recommendations fail
    const refResponse = await fetch(
      `${SEMANTIC_SCHOLAR_API}/paper/${paperId}/references?fields=${fields}&limit=${limit}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!refResponse.ok) {
      throw new Error(`Semantic Scholar API error: ${refResponse.status}`);
    }

    const refData = await refResponse.json();
    return {
      similarPapers: (refData.data || []).map((item: any) => ({
        title: item.citedPaper?.title || '',
        authors: (item.citedPaper?.authors || []).map((a: any) => a.name),
        year: item.citedPaper?.year,
        abstract: item.citedPaper?.abstract,
        venue: item.citedPaper?.venue,
        citations: item.citedPaper?.citationCount,
        url: item.citedPaper?.url
      })),
      originalTitle: searchResult.publications[0].title
    };
  }

  const data = await response.json();
  return {
    similarPapers: (data.recommendedPapers || []).map((paper: any) => ({
      title: paper.title,
      authors: (paper.authors || []).map((a: any) => a.name),
      year: paper.year,
      abstract: paper.abstract,
      venue: paper.venue,
      citations: paper.citationCount,
      url: paper.url
    })),
    originalTitle: searchResult.publications[0].title
  };
};

/**
 * Generate BibTeX from paper data (when API doesn't provide it)
 */
const generateBibtex = (pub: Publication): string => {
  const firstAuthor = pub.authors[0] || 'Unknown';
  const lastName = firstAuthor.split(' ').pop() || 'unknown';
  const citeKey = `${lastName.toLowerCase()}${pub.year || ''}`;
  
  const entryType = pub.venue?.toLowerCase().includes('conference') ? 'inproceedings' : 'article';
  
  let bibtex = `@${entryType}{${citeKey},\n`;
  bibtex += `  author = {${pub.authors.join(' and ')}},\n`;
  bibtex += `  title = {${pub.title}},\n`;
  if (pub.year) bibtex += `  year = {${pub.year}},\n`;
  if (pub.venue) {
    if (entryType === 'inproceedings') {
      bibtex += `  booktitle = {${pub.venue}},\n`;
    } else {
      bibtex += `  journal = {${pub.venue}},\n`;
    }
  }
  if (pub.doi) bibtex += `  doi = {${pub.doi}},\n`;
  if (pub.url) bibtex += `  url = {${pub.url}},\n`;
  bibtex += `}`;
  
  return bibtex;
};

// ==========================================
// Public API (with automatic fallback)
// ==========================================

/**
 * Search for publications (uses Scholarly API if available, falls back to Semantic Scholar)
 */
export const searchPublications = async (query: string, limit: number = 10): Promise<SearchResult> => {
  const useScholarly = await checkScholarlyApiStatus();
  
  try {
    if (useScholarly) {
      console.log('📚 Searching with Scholarly API (Google Scholar)');
      return await searchPublicationsScholarly(query, limit);
    }
  } catch (error) {
    console.warn('Scholarly API failed, falling back to Semantic Scholar:', error);
  }
  
  console.log('📚 Searching with Semantic Scholar API');
  return await searchPublicationsSemanticScholar(query, limit);
};

/**
 * Get citations for a paper
 */
export const getCitations = async (title: string, limit: number = 20): Promise<CitationResult> => {
  const useScholarly = await checkScholarlyApiStatus();
  
  try {
    if (useScholarly) {
      console.log('📖 Getting citations from Scholarly API');
      return await getCitationsScholarly(title, limit);
    }
  } catch (error) {
    console.warn('Scholarly API failed, falling back to Semantic Scholar:', error);
  }
  
  console.log('📖 Getting citations from Semantic Scholar API');
  return await getCitationsSemanticScholar(title, limit);
};

/**
 * Find similar/related papers
 */
export const getSimilarPapers = async (title: string, limit: number = 10): Promise<SimilarPapersResult> => {
  const useScholarly = await checkScholarlyApiStatus();
  
  try {
    if (useScholarly) {
      console.log('🔗 Finding similar papers with Scholarly API');
      return await getSimilarPapersScholarly(title, limit);
    }
  } catch (error) {
    console.warn('Scholarly API failed, falling back to Semantic Scholar:', error);
  }
  
  console.log('🔗 Finding similar papers with Semantic Scholar API');
  return await getSimilarPapersSemanticScholar(title, limit);
};

/**
 * Get BibTeX citation for a paper
 */
export const getBibtex = async (title: string): Promise<string> => {
  const useScholarly = await checkScholarlyApiStatus();
  
  try {
    if (useScholarly) {
      console.log('📋 Getting BibTeX from Scholarly API');
      return await getBibtexScholarly(title);
    }
  } catch (error) {
    console.warn('Scholarly API failed, generating BibTeX from Semantic Scholar:', error);
  }
  
  // Get paper data and generate BibTeX
  console.log('📋 Generating BibTeX from Semantic Scholar data');
  const searchResult = await searchPublicationsSemanticScholar(title, 1);
  if (searchResult.publications.length === 0) {
    throw new Error('Paper not found');
  }
  return generateBibtex(searchResult.publications[0]);
};

/**
 * Search for authors
 */
export const searchAuthors = async (name: string, limit: number = 5): Promise<Author[]> => {
  const useScholarly = await checkScholarlyApiStatus();
  
  if (useScholarly) {
    try {
      const response = await fetch(
        `${SCHOLARLY_API_URL}/search/author?name=${encodeURIComponent(name)}&limit=${limit}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.authors.map((a: any) => ({
          name: a.name,
          affiliation: a.affiliation,
          scholarId: a.scholar_id,
          citedBy: a.citedby,
          interests: a.interests
        }));
      }
    } catch (error) {
      console.warn('Author search failed:', error);
    }
  }
  
  // Semantic Scholar author search
  const response = await fetch(
    `${SEMANTIC_SCHOLAR_API}/author/search?query=${encodeURIComponent(name)}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.data || []).map((a: any) => ({
    name: a.name,
    affiliation: a.affiliations?.[0],
    citedBy: a.citationCount
  }));
};

/**
 * Get multiple BibTeX citations for a list of paper titles
 */
export const getBibtexBatch = async (titles: string[]): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  
  for (const title of titles) {
    try {
      const bibtex = await getBibtex(title);
      results.set(title, bibtex);
    } catch (error) {
      console.warn(`Failed to get BibTeX for "${title}":`, error);
    }
  }
  
  return results;
};

/**
 * Comprehensive paper search - searches and enriches with citations, similar papers
 */
export const comprehensivePaperSearch = async (query: string): Promise<{
  papers: Publication[];
  relatedPapers: Publication[];
  suggestedCitations: Publication[];
}> => {
  // Search for main papers
  const searchResult = await searchPublications(query, 10);
  
  // Get related papers from the top result
  let relatedPapers: Publication[] = [];
  if (searchResult.publications.length > 0) {
    try {
      const similarResult = await getSimilarPapers(searchResult.publications[0].title, 5);
      relatedPapers = similarResult.similarPapers;
    } catch (e) {
      console.warn('Could not get similar papers:', e);
    }
  }
  
  // Get highly cited papers as suggested citations
  const suggestedCitations = searchResult.publications
    .filter(p => (p.citations || 0) > 50)
    .slice(0, 5);
  
  return {
    papers: searchResult.publications,
    relatedPapers,
    suggestedCitations
  };
};
