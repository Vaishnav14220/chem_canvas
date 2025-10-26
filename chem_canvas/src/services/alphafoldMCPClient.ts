import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

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

interface MCPStructureResult {
  entryId: string;
  structure: AlphaFoldPrediction;
  pdbContent?: string;
  confidenceAnalysis?: {
    averageConfidence: number;
    highConfidenceRegions: Array<{ start: number; end: number; confidence: number }>;
    lowConfidenceRegions: Array<{ start: number; end: number; confidence: number }>;
  };
}

class AlphaFoldMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: any = null;

  async connect(): Promise<void> {
    try {
      console.log('[MCP] Starting AlphaFold MCP server...');
      
      // Start the MCP server process
      const serverPath = 'c:\\Users\\vaish\\Downloads\\studium_chem_git\\chem_canvas\\alphafold-mcp-server\\build\\index.js';
      this.serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Create transport using the server's stdio
      this.transport = new StdioClientTransport({
        readable: this.serverProcess.stdout,
        writable: this.serverProcess.stdin
      });

      // Create and initialize client
      this.client = new Client({
        name: 'alphafold-frontend-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });

      await this.client.connect(this.transport);
      console.log('[MCP] Connected to AlphaFold MCP server');
    } catch (error) {
      console.error('[MCP] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }
      console.log('[MCP] Disconnected from MCP server');
    } catch (error) {
      console.error('[MCP] Error during disconnect:', error);
    }
  }

  async getStructure(uniprotId: string): Promise<MCPStructureResult | null> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Getting structure for ${uniprotId}`);
      
      const result = await this.client.callTool({
        name: 'get_structure',
        arguments: {
          uniprot_id: uniprotId
        }
      });

      if (result.content?.[0]?.text) {
        const structureData = JSON.parse(result.content[0].text);
        console.log(`[MCP] Retrieved structure:`, structureData);
        return structureData;
      }

      return null;
    } catch (error) {
      console.error(`[MCP] Error getting structure for ${uniprotId}:`, error);
      throw error;
    }
  }

  async downloadStructure(uniprotId: string, format: 'pdb' | 'cif' = 'pdb'): Promise<string | null> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Downloading ${format.toUpperCase()} for ${uniprotId}`);
      
      const result = await this.client.callTool({
        name: 'download_structure',
        arguments: {
          uniprot_id: uniprotId,
          format: format
        }
      });

      if (result.content?.[0]?.text) {
        console.log(`[MCP] Downloaded ${format.toUpperCase()} structure`);
        return result.content[0].text;
      }

      return null;
    } catch (error) {
      console.error(`[MCP] Error downloading structure for ${uniprotId}:`, error);
      throw error;
    }
  }

  async getConfidenceScores(uniprotId: string): Promise<number[] | null> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Getting confidence scores for ${uniprotId}`);
      
      const result = await this.client.callTool({
        name: 'get_confidence_scores',
        arguments: {
          uniprot_id: uniprotId
        }
      });

      if (result.content?.[0]?.text) {
        const scores = JSON.parse(result.content[0].text);
        console.log(`[MCP] Retrieved confidence scores:`, scores.length, 'scores');
        return scores;
      }

      return null;
    } catch (error) {
      console.error(`[MCP] Error getting confidence scores for ${uniprotId}:`, error);
      throw error;
    }
  }

  async analyzeConfidenceRegions(uniprotId: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Analyzing confidence regions for ${uniprotId}`);
      
      const result = await this.client.callTool({
        name: 'analyze_confidence_regions',
        arguments: {
          uniprot_id: uniprotId
        }
      });

      if (result.content?.[0]?.text) {
        const analysis = JSON.parse(result.content[0].text);
        console.log(`[MCP] Confidence analysis:`, analysis);
        return analysis;
      }

      return null;
    } catch (error) {
      console.error(`[MCP] Error analyzing confidence regions for ${uniprotId}:`, error);
      throw error;
    }
  }

  async searchStructures(query: string, limit: number = 10): Promise<AlphaFoldPrediction[]> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Searching structures for: ${query}`);
      
      const result = await this.client.callTool({
        name: 'search_structures',
        arguments: {
          query: query,
          limit: limit
        }
      });

      if (result.content?.[0]?.text) {
        const results = JSON.parse(result.content[0].text);
        console.log(`[MCP] Found ${results.length} structures`);
        return results;
      }

      return [];
    } catch (error) {
      console.error(`[MCP] Error searching structures:`, error);
      throw error;
    }
  }

  async validateStructureQuality(uniprotId: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Validating structure quality for ${uniprotId}`);
      
      const result = await this.client.callTool({
        name: 'validate_structure_quality',
        arguments: {
          uniprot_id: uniprotId
        }
      });

      if (result.content?.[0]?.text) {
        const validation = JSON.parse(result.content[0].text);
        console.log(`[MCP] Structure quality validation:`, validation);
        return validation;
      }

      return null;
    } catch (error) {
      console.error(`[MCP] Error validating structure quality for ${uniprotId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const alphafoldMCPClient = new AlphaFoldMCPClient();
export type { AlphaFoldPrediction, MCPStructureResult };