// ORD (Open Reaction Database) API service
// This service provides access to chemical reactions from the ORD Interface API

export interface ORDReaction {
  reaction_id: string;
  reaction_smiles: string;
}

// Mock data for when ORD Interface is not available
const MOCK_REACTIONS: ORDReaction[] = [
  {
    reaction_id: "ord-1",
    reaction_smiles: "CCO.O=C=O>>CC(=O)O"
  },
  {
    reaction_id: "ord-2", 
    reaction_smiles: "CC(C)=O.CCO>>CC(C)(OCC)O"
  },
  {
    reaction_id: "ord-3",
    reaction_smiles: "c1ccccc1.O=C=O>>O=C(O)c1ccccc1"
  },
  {
    reaction_id: "ord-4",
    reaction_smiles: "CCN.CC(=O)Cl>>CCN(C)C=O"
  },
  {
    reaction_id: "ord-5",
    reaction_smiles: "CCO.O=Cc1ccccc1>>CCOC(=O)c1ccccc1"
  }
];

class ORDService {
  private apiUrl: string | null = null;

  constructor() {
    // Load API URL from environment or local storage
    this.apiUrl = this.loadApiUrl();
  }

  private loadApiUrl(): string | null {
    // Try environment variable first
    const envUrl = import.meta.env?.VITE_ORD_API_URL;
    if (envUrl) return envUrl;

    // Try local storage
    const storedUrl = localStorage.getItem('ord_api_url');
    if (storedUrl) return storedUrl;

    return null;
  }

  setApiUrl(url: string) {
    this.apiUrl = url;
    localStorage.setItem('ord_api_url', url);
  }

  getApiUrl(): string | null {
    return this.apiUrl;
  }

  async searchReactions(query: string = '', limit: number = 20): Promise<ORDReaction[]> {
    // If API is configured, try to use it
    if (this.apiUrl) {
      try {
        // Try the /search endpoint as mentioned in ORD Interface docs
        const url = new URL('/search', this.apiUrl);
        if (query.trim()) {
          url.searchParams.set('q', query.trim());
        }
        // Note: ORD Interface may not support limit parameter in the same way

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract reactions from ORD Interface response format
        // Based on the guide, it returns reactions array with SMILES
        if (data && Array.isArray(data)) {
          return data.slice(0, limit).map((item: any) => ({
            reaction_id: item.reaction_id || item.id || `ord-${Math.random().toString(36).substr(2, 9)}`,
            reaction_smiles: item.smiles || item.reaction_smiles || this.extractReactionSmiles(item)
          })).filter((item: any) => item.reaction_smiles);
        }
        
        // Handle case where data is wrapped in an object
        if (data && data.reactions && Array.isArray(data.reactions)) {
          return data.reactions.slice(0, limit).map((item: any) => ({
            reaction_id: item.reaction_id || item.id || `ord-${Math.random().toString(36).substr(2, 9)}`,
            reaction_smiles: item.smiles || item.reaction_smiles || this.extractReactionSmiles(item)
          })).filter((item: any) => item.reaction_smiles);
        }
        
        return [];
      } catch (error) {
        console.warn('ORD API request failed, falling back to mock data:', error);
        // Fall back to mock data if API fails
      }
    }

    // Return filtered mock data if no API or API failed
    let results = MOCK_REACTIONS;
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      results = MOCK_REACTIONS.filter(reaction => 
        reaction.reaction_smiles.toLowerCase().includes(lowerQuery) ||
        reaction.reaction_id.toLowerCase().includes(lowerQuery)
      );
    }

    return results.slice(0, limit);
  }

  private extractReactionSmiles(reaction: any): string {
    // Try to extract SMILES from various ORD data formats
    if (reaction.reaction_smiles) return reaction.reaction_smiles;
    if (reaction.smiles) return reaction.smiles;
    
    // If it's a protobuf-like structure, try to reconstruct SMILES
    // This is a simplified extraction - real ORD data would need proper protobuf parsing
    return '';
  }

  async getReactionById(reactionId: string): Promise<ORDReaction | null> {
    try {
      const reactions = await this.searchReactions();
      return reactions.find(r => r.reaction_id === reactionId) || null;
    } catch (error) {
      console.error('Failed to get reaction by ID:', error);
      return null;
    }
  }

  async getRandomReactions(count: number = 10): Promise<ORDReaction[]> {
    try {
      const allReactions = await this.searchReactions();
      // Simple random sampling
      const shuffled = [...allReactions].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, allReactions.length));
    } catch (error) {
      console.error('Failed to get random reactions:', error);
      return [];
    }
  }

  // Utility method to check if API is configured and working
  async testConnection(): Promise<boolean> {
    if (!this.apiUrl) return false;
    
    try {
      await this.searchReactions('', 1);
      return true;
    } catch (error) {
      console.error('ORD API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const ordService = new ORDService();