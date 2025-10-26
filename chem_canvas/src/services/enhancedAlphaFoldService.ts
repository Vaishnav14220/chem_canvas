// Enhanced AlphaFold service that can optionally use MCP server
interface AlphaFoldPrediction {
  entryId: string;
  uniprotAccession: string;
  gene?: string;
  uniprotDescription?: string;
  organismScientificName?: string;
  uniprotStart?: number;
  uniprotEnd?: number;
  uniprotSequence?: string;
  modelCreatedDate?: string;
  latestVersion?: number;
  allVersions?: number[];
  pdbUrl?: string;
  cifUrl?: string;
  bcifUrl?: string;
  paeDocUrl?: string;
  paeImageUrl?: string;
  confidenceScores?: number[];
  plddt?: number[];
  modelConfidence?: number[];
}

interface ConfidenceAnalysis {
  averageConfidence: number;
  highConfidenceRegions: Array<{ start: number; end: number; confidence: number }>;
  lowConfidenceRegions: Array<{ start: number; end: number; confidence: number }>;
  qualityMetrics: {
    veryHighConfidence: number; // >90
    highConfidence: number;     // 70-90
    mediumConfidence: number;   // 50-70
    lowConfidence: number;      // <50
  };
}

interface MCPResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class EnhancedAlphaFoldService {
  private mcpServerUrl: string | null = null;
  private useMCP = false;

  constructor() {
    // Check if MCP server is available (this would be configured)
    this.mcpServerUrl = 'http://localhost:3001'; // MCP proxy server
  }

  async enableMCP(): Promise<boolean> {
    try {
      // Test if MCP proxy server is available
      const response = await fetch(`${this.mcpServerUrl}/health`, {
        method: 'GET',
        timeout: 2000
      } as any);
      
      if (response.ok) {
        this.useMCP = true;
        console.log('[AlphaFold] MCP server enabled');
        return true;
      }
    } catch (error) {
      console.log('[AlphaFold] MCP server not available, using direct API');
    }
    
    this.useMCP = false;
    return false;
  }

  async getStructureEnhanced(uniprotId: string): Promise<AlphaFoldPrediction | null> {
    if (this.useMCP) {
      return this.getStructureViaMCP(uniprotId);
    }
    return this.getStructureDirect(uniprotId);
  }

  private async getStructureViaMCP(uniprotId: string): Promise<AlphaFoldPrediction | null> {
    try {
      const response = await fetch(`${this.mcpServerUrl}/api/structure/${uniprotId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status}`);
      }

      const result: MCPResponse<AlphaFoldPrediction> = await response.json();
      
      if (result.success && result.data) {
        console.log(`[AlphaFold-MCP] Retrieved structure for ${uniprotId}`);
        return result.data;
      }

      throw new Error(result.error || 'MCP request failed');
    } catch (error) {
      console.error(`[AlphaFold-MCP] Error:`, error);
      // Fallback to direct API
      return this.getStructureDirect(uniprotId);
    }
  }

  private async getStructureDirect(uniprotId: string): Promise<AlphaFoldPrediction | null> {
    try {
      const response = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`AlphaFold API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[AlphaFold-Direct] Retrieved structure for ${uniprotId}`);
      return data[0] || null;
    } catch (error) {
      console.error(`[AlphaFold-Direct] Error:`, error);
      throw error;
    }
  }

  async downloadPDBContent(pdbUrl: string): Promise<string | null> {
    if (this.useMCP) {
      return this.downloadPDBViaMCP(pdbUrl);
    }
    return this.downloadPDBDirect(pdbUrl);
  }

  private async downloadPDBViaMCP(pdbUrl: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.mcpServerUrl}/api/download-pdb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdbUrl })
      });

      if (!response.ok) {
        throw new Error(`MCP PDB download failed: ${response.status}`);
      }

      const result: MCPResponse<string> = await response.json();
      
      if (result.success && result.data) {
        console.log(`[AlphaFold-MCP] Downloaded PDB content`);
        return result.data;
      }

      throw new Error(result.error || 'MCP PDB download failed');
    } catch (error) {
      console.error(`[AlphaFold-MCP] PDB download error:`, error);
      // Fallback to direct
      return this.downloadPDBDirect(pdbUrl);
    }
  }

  private async downloadPDBDirect(pdbUrl: string): Promise<string | null> {
    try {
      // Try direct fetch first
      let response = await fetch(pdbUrl);
      
      if (!response.ok) {
        // Try CORS proxy fallback
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(pdbUrl)}`;
        response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`PDB download failed: ${response.status}`);
        }
      }

      const pdbContent = await response.text();
      console.log(`[AlphaFold-Direct] Downloaded PDB content (${pdbContent.length} chars)`);
      return pdbContent;
    } catch (error) {
      console.error(`[AlphaFold-Direct] PDB download error:`, error);
      throw error;
    }
  }

  async getConfidenceAnalysis(uniprotId: string): Promise<ConfidenceAnalysis | null> {
    if (this.useMCP) {
      return this.getConfidenceViaMCP(uniprotId);
    }
    return this.analyzeConfidenceDirect(uniprotId);
  }

  private async getConfidenceViaMCP(uniprotId: string): Promise<ConfidenceAnalysis | null> {
    try {
      const response = await fetch(`${this.mcpServerUrl}/api/confidence/${uniprotId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`MCP confidence request failed: ${response.status}`);
      }

      const result: MCPResponse<ConfidenceAnalysis> = await response.json();
      
      if (result.success && result.data) {
        console.log(`[AlphaFold-MCP] Retrieved confidence analysis for ${uniprotId}`);
        return result.data;
      }

      throw new Error(result.error || 'MCP confidence request failed');
    } catch (error) {
      console.error(`[AlphaFold-MCP] Confidence error:`, error);
      // Fallback to direct analysis
      return this.analyzeConfidenceDirect(uniprotId);
    }
  }

  private async analyzeConfidenceDirect(uniprotId: string): Promise<ConfidenceAnalysis | null> {
    try {
      const structure = await this.getStructureDirect(uniprotId);
      if (!structure?.confidenceScores) {
        return null;
      }

      const scores = structure.confidenceScores;
      const averageConfidence = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      // Analyze confidence regions
      const highConfidenceRegions: Array<{ start: number; end: number; confidence: number }> = [];
      const lowConfidenceRegions: Array<{ start: number; end: number; confidence: number }> = [];
      
      let currentRegion: { start: number; end: number; confidence: number; isHigh: boolean } | null = null;
      
      scores.forEach((score, index) => {
        const isHigh = score >= 70;
        
        if (!currentRegion) {
          currentRegion = { start: index, end: index, confidence: score, isHigh };
        } else if (currentRegion.isHigh === isHigh) {
          currentRegion.end = index;
          currentRegion.confidence = (currentRegion.confidence + score) / 2;
        } else {
          // Region change
          if (currentRegion.isHigh) {
            highConfidenceRegions.push({
              start: currentRegion.start,
              end: currentRegion.end,
              confidence: currentRegion.confidence
            });
          } else {
            lowConfidenceRegions.push({
              start: currentRegion.start,
              end: currentRegion.end,
              confidence: currentRegion.confidence
            });
          }
          currentRegion = { start: index, end: index, confidence: score, isHigh };
        }
      });

      // Add final region
      if (currentRegion) {
        if (currentRegion.isHigh) {
          highConfidenceRegions.push({
            start: currentRegion.start,
            end: currentRegion.end,
            confidence: currentRegion.confidence
          });
        } else {
          lowConfidenceRegions.push({
            start: currentRegion.start,
            end: currentRegion.end,
            confidence: currentRegion.confidence
          });
        }
      }

      // Quality metrics
      const veryHighConfidence = scores.filter(s => s > 90).length / scores.length * 100;
      const highConfidence = scores.filter(s => s >= 70 && s <= 90).length / scores.length * 100;
      const mediumConfidence = scores.filter(s => s >= 50 && s < 70).length / scores.length * 100;
      const lowConfidence = scores.filter(s => s < 50).length / scores.length * 100;

      const analysis: ConfidenceAnalysis = {
        averageConfidence,
        highConfidenceRegions,
        lowConfidenceRegions,
        qualityMetrics: {
          veryHighConfidence,
          highConfidence,
          mediumConfidence,
          lowConfidence
        }
      };

      console.log(`[AlphaFold-Direct] Analyzed confidence for ${uniprotId}:`, analysis);
      return analysis;
    } catch (error) {
      console.error(`[AlphaFold-Direct] Confidence analysis error:`, error);
      throw error;
    }
  }

  async searchStructures(query: string, limit: number = 10): Promise<AlphaFoldPrediction[]> {
    if (this.useMCP) {
      return this.searchViaMCP(query, limit);
    }
    return this.searchDirect(query, limit);
  }

  private async searchViaMCP(query: string, limit: number): Promise<AlphaFoldPrediction[]> {
    try {
      const response = await fetch(`${this.mcpServerUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });

      if (!response.ok) {
        throw new Error(`MCP search failed: ${response.status}`);
      }

      const result: MCPResponse<AlphaFoldPrediction[]> = await response.json();
      
      if (result.success && result.data) {
        console.log(`[AlphaFold-MCP] Search found ${result.data.length} results`);
        return result.data;
      }

      throw new Error(result.error || 'MCP search failed');
    } catch (error) {
      console.error(`[AlphaFold-MCP] Search error:`, error);
      // Fallback to direct search
      return this.searchDirect(query, limit);
    }
  }

  private async searchDirect(query: string, limit: number): Promise<AlphaFoldPrediction[]> {
    try {
      // Basic search implementation - in reality this would need more sophisticated search
      // For now, treat query as potential UniProt ID and try to fetch it
      const structure = await this.getStructureDirect(query);
      if (structure) {
        console.log(`[AlphaFold-Direct] Search found 1 result for ${query}`);
        return [structure];
      }
      
      console.log(`[AlphaFold-Direct] No results found for ${query}`);
      return [];
    } catch (error) {
      console.error(`[AlphaFold-Direct] Search error:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const enhancedAlphaFoldService = new EnhancedAlphaFoldService();
export type { AlphaFoldPrediction, ConfidenceAnalysis, MCPResponse };