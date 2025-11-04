import '@rdkit/rdkit';
import { RDKitModule, JSMol } from '@rdkit/rdkit';
import { ReactionComponentDetails } from './reactionResolver';
import { generateTextContent, isGeminiInitialized } from './geminiService';
import { sanitizeReactionSmilesInput } from '../utils/reactionSanitizer';

let rdkit: RDKitModule | null = null;

type ReactionComponentRole = ReactionComponentDetails['role'];

export interface ReactionSvgOptions {
  components?: ReactionComponentDetails[];
}

export interface ReactionVisualizationResult {
  previewSvg: string | null;
  reactionSvg: string | null;
  highlightSvg: string | null;
}

interface HighlightElements {
  atoms: number[];
  bonds: number[];
}

const ROLE_PRESENTATION: Record<ReactionComponentRole, { color: string; descriptor: string }> = {
  reactant: { color: '#f472b6', descriptor: 'Active Center' },
  agent: { color: '#34d399', descriptor: 'Attacking Center' },
  product: { color: '#60a5fa', descriptor: 'Leaving Group' }
};

const HIGHLIGHT_SMARTS: Record<ReactionComponentRole, string[]> = {
  reactant: ['[CX3](=O)[OX1H0-,OX2H1]', '[#6]=O', '[#6]=[#6]'],
  agent: ['[O-]', '[N-]', '[S-]', '[Mg]', '[Li]', '[Na]'],
  product: ['[F,Cl,Br,I]', 'OS(=O)(=O)[O-]', '[#6]-[O]-[#6]']
};

export interface MoleculeProperties {
  molecularWeight: number;
  logP: number;
  tpsa: number;
  hbd: number; // hydrogen bond donors
  hba: number; // hydrogen bond acceptors
  rotatableBonds: number;
  formula: string;
  smiles: string;
  inchi: string;
  inchikey: string;
}

export interface RDKitMolecule {
  mol: JSMol;
  smiles: string;
  properties?: MoleculeProperties;
}

class RDKitService {
  private static instance: RDKitService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): RDKitService {
    if (!RDKitService.instance) {
      RDKitService.instance = new RDKitService();
    }
    return RDKitService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Wait for RDKit script to load
    const waitForRDKit = (retries = 10): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (typeof window.initRDKitModule === 'function') {
          resolve();
          return;
        }
        
        if (retries <= 0) {
          reject(new Error('RDKit script failed to load'));
          return;
        }
        
        setTimeout(() => {
          waitForRDKit(retries - 1).then(resolve).catch(reject);
        }, 500);
      });
    };

    try {
      await waitForRDKit();
      // Initialize RDKit module
      rdkit = await window.initRDKitModule();
      this.isInitialized = true;
      console.log('RDKit-JS initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RDKit-JS:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized && rdkit !== null;
  }

  async parseMolecule(smiles: string): Promise<RDKitMolecule | null> {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!rdkit) return null;

    try {
      const mol = rdkit.get_mol(smiles);
      if (!mol) {
        console.warn('Failed to parse SMILES:', smiles);
        return null;
      }

      return {
        mol,
        smiles,
        properties: await this.calculateProperties(mol, smiles)
      };
    } catch (error) {
      console.error('Error parsing molecule with RDKit:', error);
      return null;
    }
  }

  async calculateProperties(mol: JSMol, smiles: string): Promise<MoleculeProperties | undefined> {
    if (!this.isReady() || !mol) return undefined;

    try {
      const descriptors = JSON.parse(mol.get_descriptors());
      const inchi = mol.get_inchi();

      return {
        molecularWeight: descriptors.exactmw || descriptors.mw || 0,
        logP: descriptors.logp || 0,
        tpsa: descriptors.tpsa || 0,
        hbd: descriptors.hbd || 0,
        hba: descriptors.hba || 0,
        rotatableBonds: descriptors.rotatable_bonds || 0,
        formula: descriptors.formula || '',
        smiles: mol.get_smiles(),
        inchi: inchi,
        inchikey: rdkit!.get_inchikey_for_inchi(inchi)
      };
    } catch (error) {
      console.error('Error calculating molecule properties:', error);
      return undefined;
    }
  }

  async generate2DCoords(mol: JSMol): Promise<boolean> {
    if (!this.isReady() || !mol) return false;

    try {
      return mol.set_new_coords();
    } catch (error) {
      console.error('Error generating 2D coordinates:', error);
      return false;
    }
  }

  async getSVG(mol: JSMol, width = 300, height = 200): Promise<string | null> {
    if (!this.isReady() || !mol) return null;

    try {
      // Generate 2D coordinates if not present
      await this.generate2DCoords(mol);

      // Get SVG representation
      const svg = mol.get_svg(width, height);
      return svg;
    } catch (error) {
      console.error('Error generating SVG:', error);
      return null;
    }
  }

  async substructureSearch(mol: JSMol, querySmiles: string): Promise<boolean> {
    if (!this.isReady() || !mol) return false;

    try {
      const queryMol = rdkit!.get_qmol(querySmiles);
      if (!queryMol) return false;

      const matchesJson = mol.get_substruct_matches(queryMol);
      const matches = JSON.parse(matchesJson);
      queryMol.delete();
      return matches.length > 0;
    } catch (error) {
      console.error('Error in substructure search:', error);
      return false;
    }
  }

  async findSubstructureMatches(mol: JSMol, querySmiles: string): Promise<number[][]> {
    if (!this.isReady() || !mol) return [];

    try {
      const queryMol = rdkit!.get_qmol(querySmiles);
      if (!queryMol) return [];

      const matchesJson = mol.get_substruct_matches(queryMol);
      const matches = JSON.parse(matchesJson);
      queryMol.delete();
      return matches;
    } catch (error) {
      console.error('Error finding substructure matches:', error);
      return [];
    }
  }

  disposeMolecule(mol: JSMol): void {
    if (mol) {
      try {
        mol.delete();
      } catch (error) {
        console.warn('Error disposing molecule:', error);
      }
    }
  }

  // Utility method to validate SMILES
  async validateSmiles(smiles: string): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const mol = rdkit!.get_mol(smiles);
      if (!mol) return false;

      const isValid = mol.is_valid();
      mol.delete();
      return isValid;
    } catch (error) {
      return false;
    }
  }

  // Convert between formats
  async smilesToInchi(smiles: string): Promise<string | null> {
    const molecule = await this.parseMolecule(smiles);
    if (!molecule) return null;

    try {
      return molecule.properties?.inchi || null;
    } finally {
      this.disposeMolecule(molecule.mol);
    }
  }

  async smilesToInchiKey(smiles: string): Promise<string | null> {
    const molecule = await this.parseMolecule(smiles);
    if (!molecule) return null;

    try {
      return molecule.properties?.inchikey || null;
    } finally {
      this.disposeMolecule(molecule.mol);
    }
  }

  // Analyze reaction to identify atoms and bonds involved in the transformation
  async identifyReactionCenters(reactionSmiles: string, components?: ReactionComponentDetails[]): Promise<{
    reactants: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    products: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    agents: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
  }> {
    if (!this.isReady()) {
      await this.initialize();
    }

    // Try Gemini-powered analysis first if available
    if (isGeminiInitialized() && components && components.length > 0) {
      try {
        const geminiResult = await this.analyzeReactionWithGemini(reactionSmiles, components);
        if (geminiResult) {
          return geminiResult;
        }
      } catch (error) {
        console.warn('Gemini reaction analysis failed, falling back to basic analysis:', error);
      }
    }

    const sections = reactionSmiles.split('>');
    if (sections.length < 2) {
      throw new Error('Invalid reaction format');
    }

    const reactantSection = sections[0]?.trim() || '';
    let agentSection = '';
    let productSection = '';

    if (sections.length === 2) {
      productSection = sections[1]?.trim() || '';
    } else {
      agentSection = sections[1]?.trim() || '';
      productSection = sections.slice(2).join('>').trim();
    }

    const parseSection = (section: string) => section.split('.').map(s => s.trim()).filter(s => s.length > 0);

    const reactants = parseSection(reactantSection);
    const agents = parseSection(agentSection);
    const products = parseSection(productSection);

    // Use component-based analysis if available
    if (components && components.length > 0) {
      return this.identifyReactionCentersFromComponents(reactants, agents, products, components);
    }

    // Fallback to basic functional group detection
    return this.identifyReactionCentersBasic(reactants, agents, products);
  }

  private async analyzeReactionWithGemini(
    reactionSmiles: string,
    components: ReactionComponentDetails[]
  ): Promise<{
    reactants: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    products: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    agents: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
  } | null> {
    try {
      const componentText = components.map(comp =>
        `${comp.role}: ${comp.smiles || comp.original} (${comp.label || 'unlabeled'})`
      ).join('\n');

      const prompt = `Analyze this chemical reaction and identify the atoms and bonds involved in the reaction mechanism:

Reaction SMILES: ${reactionSmiles}

Components:
${componentText}

Please identify for each molecule:
1. Active centers (atoms that undergo change)
2. Attacking centers (atoms that attack in the reaction)
3. Leaving groups (atoms/bonds that leave during reaction)

Return a JSON object with this structure:
{
  "reactants": [{"smiles": "SMILES", "active_atoms": [indices], "active_bonds": [indices]}],
  "agents": [{"smiles": "SMILES", "attacking_atoms": [indices], "attacking_bonds": [indices]}],
  "products": [{"smiles": "SMILES", "leaving_atoms": [indices], "leaving_bonds": [indices]}]
}

Focus on atoms and bonds that are actually involved in the chemical transformation. Be precise and use 0-based indexing.`;

      const response = await generateTextContent(prompt);
      const parsed = JSON.parse(response);

      // Convert Gemini response to our format
      return {
        reactants: (parsed.reactants || []).map((r: any) => ({
          smiles: r.smiles,
          atoms: r.active_atoms || [],
          bonds: r.active_bonds || []
        })),
        agents: (parsed.agents || []).map((a: any) => ({
          smiles: a.smiles,
          atoms: a.attacking_atoms || [],
          bonds: a.attacking_bonds || []
        })),
        products: (parsed.products || []).map((p: any) => ({
          smiles: p.smiles,
          atoms: p.leaving_atoms || [],
          bonds: p.leaving_bonds || []
        }))
      };
    } catch (error) {
      console.warn('Failed to analyze reaction with Gemini:', error);
      return null;
    }
  }

  private async identifyReactionCentersFromComponents(
    reactants: string[],
    agents: string[],
    products: string[],
    components: ReactionComponentDetails[]
  ): Promise<{
    reactants: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    products: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    agents: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
  }> {
    const result = {
      reactants: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>,
      products: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>,
      agents: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>
    };

    // Process each component type
    for (const component of components) {
      const smiles = component.smiles || component.canonicalSmiles;
      if (!smiles) continue;

      const molecule = await this.parseMolecule(smiles);
      if (!molecule) continue;

      try {
        let atoms: number[] = [];
        let bonds: number[] = [];

        // Try to identify reaction centers based on component role
        const highlight = this.identifyHighlightElements(molecule.mol, component.role);

        // If no specific highlights found, try to identify key functional groups
        if (!highlight.atoms.length) {
          atoms = this.identifyKeyFunctionalAtoms(molecule.mol, component.role);
        } else {
          atoms = highlight.atoms;
          bonds = highlight.bonds;
        }

        const entry = { smiles, atoms, bonds };

        switch (component.role) {
          case 'reactant':
            result.reactants.push(entry);
            break;
          case 'agent':
            result.agents.push(entry);
            break;
          case 'product':
            result.products.push(entry);
            break;
        }
      } finally {
        this.disposeMolecule(molecule.mol);
      }
    }

    return result;
  }

  private async identifyReactionCentersBasic(
    reactants: string[],
    agents: string[],
    products: string[]
  ): Promise<{
    reactants: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    products: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
    agents: Array<{ smiles: string; atoms: number[]; bonds: number[] }>;
  }> {
    const result = {
      reactants: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>,
      products: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>,
      agents: [] as Array<{ smiles: string; atoms: number[]; bonds: number[] }>
    };

    // Process reactants
    for (const smiles of reactants) {
      const molecule = await this.parseMolecule(smiles);
      if (!molecule) continue;

      try {
        const atoms = this.identifyKeyFunctionalAtoms(molecule.mol, 'reactant');
        const bonds = this.identifyKeyFunctionalBonds(molecule.mol, 'reactant');
        result.reactants.push({ smiles, atoms, bonds });
      } finally {
        this.disposeMolecule(molecule.mol);
      }
    }

    // Process agents
    for (const smiles of agents) {
      const molecule = await this.parseMolecule(smiles);
      if (!molecule) continue;

      try {
        const atoms = this.identifyKeyFunctionalAtoms(molecule.mol, 'agent');
        const bonds = this.identifyKeyFunctionalBonds(molecule.mol, 'agent');
        result.agents.push({ smiles, atoms, bonds });
      } finally {
        this.disposeMolecule(molecule.mol);
      }
    }

    // Process products
    for (const smiles of products) {
      const molecule = await this.parseMolecule(smiles);
      if (!molecule) continue;

      try {
        const atoms = this.identifyKeyFunctionalAtoms(molecule.mol, 'product');
        const bonds = this.identifyKeyFunctionalBonds(molecule.mol, 'product');
        result.products.push({ smiles, atoms, bonds });
      } finally {
        this.disposeMolecule(molecule.mol);
      }
    }

    return result;
  }

  private identifyKeyFunctionalAtoms(mol: JSMol, role: ReactionComponentRole): number[] {
    if (!rdkit) return [];

    const patterns = HIGHLIGHT_SMARTS[role] || [];
    const foundAtoms = new Set<number>();

    for (const smarts of patterns) {
      try {
        const query = rdkit.get_qmol(smarts);
        if (!query) continue;

        const matchesJson = mol.get_substruct_matches(query);
        const matchesRaw = JSON.parse(matchesJson);
        const matchesArray: any[] = Array.isArray(matchesRaw)
          ? matchesRaw
          : Array.isArray(matchesRaw?.atoms)
            ? matchesRaw.atoms
            : [];
        query.delete();

        for (const match of matchesArray) {
          const atomIndices = Array.isArray(match?.atoms) ? match.atoms : match;
          const atoms = this.normalizeIndexArray(atomIndices);
          atoms.forEach(atom => foundAtoms.add(atom));
        }
      } catch (error) {
        console.warn(`Failed to match SMARTS "${smarts}"`, error);
      }
    }

    return Array.from(foundAtoms);
  }

  private identifyKeyFunctionalBonds(mol: JSMol, role: ReactionComponentRole): number[] {
    // For now, return empty array - bond highlighting needs more sophisticated analysis
    return [];
  }

  // Convert reaction SMILES into an MDL RXN block using RDKit when available
  async reactionSmilesToRxnBlock(reactionSmiles: string): Promise<string | null> {
    if (!reactionSmiles || reactionSmiles.indexOf('>') < 0) {
      return null;
    }

    const sanitized = sanitizeReactionSmilesInput(reactionSmiles) ?? reactionSmiles;

    if (!this.isReady()) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('RDKit initialization failed during RXN conversion.', error);
        return null;
      }
    }

    if (!rdkit) {
      return null;
    }

    let reaction: any = null;
    try {
      const factory =
        typeof (rdkit as any).get_rxn === 'function'
          ? (rdkit as any).get_rxn.bind(rdkit)
          : typeof (rdkit as any).reaction_from_smiles === 'function'
            ? (rdkit as any).reaction_from_smiles.bind(rdkit)
            : typeof (rdkit as any).get_reaction === 'function'
              ? (rdkit as any).get_reaction.bind(rdkit)
              : null;

      if (!factory) {
        console.warn('RDKit reaction factory not available in this build.');
        return null;
      }

  reaction = factory(sanitized);
      if (!reaction) {
        return null;
      }

      if (typeof reaction.sanitize === 'function') {
        try {
          reaction.sanitize();
        } catch (sanitizeError) {
          console.warn('RDKit reaction sanitize failed; continuing with raw reaction.', sanitizeError);
        }
      }

      const rxnBlock =
        typeof reaction.get_rxnblock === 'function'
          ? reaction.get_rxnblock()
          : typeof reaction.get_v3_rxnblock === 'function'
            ? reaction.get_v3_rxnblock()
            : null;

      if (!rxnBlock || typeof rxnBlock !== 'string' || !rxnBlock.trim()) {
        return null;
      }

      return rxnBlock;
    } catch (error) {
      console.warn('Failed to convert reaction SMILES to RXN block with RDKit.', error);
      return null;
    } finally {
      try {
        reaction?.delete?.();
      } catch (disposeError) {
        console.warn('Failed to dispose RDKit reaction object.', disposeError);
      }
    }
  }

  // Generate reaction SVG from reaction SMILES and optional highlight visualization
  async getReactionSVG(reactionSmiles: string, options: ReactionSvgOptions = {}): Promise<ReactionVisualizationResult> {
    if (!this.isInitialized || !rdkit) {
      throw new Error('RDKit not initialized');
    }

    let rdkitSvg: string | null = null;

    try {
      let reaction;

      if (typeof (rdkit as any).get_rxn === 'function') {
        reaction = (rdkit as any).get_rxn(reactionSmiles);
      } else if (typeof (rdkit as any).reaction_from_smiles === 'function') {
        reaction = (rdkit as any).reaction_from_smiles(reactionSmiles);
      } else if (typeof (rdkit as any).get_reaction === 'function') {
        reaction = (rdkit as any).get_reaction(reactionSmiles);
      }

      if (reaction) {
        rdkitSvg = reaction.get_svg();
        reaction.delete();
      }
    } catch (error) {
      console.warn('RDKit reaction renderer unavailable; falling back to manual composition.', error);
    }

    let highlightPanel: string | null = null;
    try {
      highlightPanel = await this.createManualReactionSVG(reactionSmiles, options.components ?? []);
    } catch (highlightError) {
      console.warn('Failed to build highlight panel for reaction.', highlightError);
    }

    const combinedPreview = rdkitSvg && highlightPanel ? this.combineSvgPanels(rdkitSvg, highlightPanel) : null;
    const stackedPreview = rdkitSvg ? this.createStackedPreview(rdkitSvg, highlightPanel) : null;
    const previewSvg = combinedPreview ?? stackedPreview ?? rdkitSvg ?? highlightPanel;
    const primarySvg = rdkitSvg ?? highlightPanel;

    if (!previewSvg || !primarySvg) {
      throw new Error('Unable to generate reaction visualization.');
    }

    return {
      previewSvg: this.normalizeSvgDimensions(previewSvg),
      reactionSvg: this.normalizeSvgDimensions(primarySvg),
      highlightSvg: highlightPanel ? this.normalizeSvgDimensions(highlightPanel) : null
    };
  }

  // Manual reaction SVG creation when RDKit-JS doesn't support reactions
  private async createManualReactionSVG(
    reactionSmiles: string,
    componentHighlights: ReactionComponentDetails[],
    options: { includeArrow?: boolean } = {}
  ): Promise<string> {
    // First, identify reaction centers
    const reactionCenters = await this.identifyReactionCenters(reactionSmiles, componentHighlights);

    const sections = reactionSmiles.split('>');
    if (sections.length < 2) {
      throw new Error('Invalid reaction format. Use "reactants>>products" format.');
    }

    const reactantSection = sections[0] ?? '';
    let agentSection = '';
    let productSection = '';

    if (sections.length === 2) {
      productSection = sections[1] ?? '';
    } else {
      agentSection = sections[1] ?? '';
      productSection = sections.slice(2).join('>');
    }

    const splitSection = (section: string) =>
      section
        .split('.')
        .map(token => token.trim())
        .filter(token => token.length > 0);

    const reactants = splitSection(reactantSection);
    const agents = splitSection(agentSection);
    const products = splitSection(productSection);

    if (reactants.length === 0 || products.length === 0) {
      throw new Error('Reaction must have both reactants and products');
    }

    const componentsByRole: Record<ReactionComponentRole, ReactionComponentDetails[]> = {
      reactant: componentHighlights.filter(component => component.role === 'reactant'),
      agent: componentHighlights.filter(component => component.role === 'agent'),
      product: componentHighlights.filter(component => component.role === 'product')
    };

    const labelQueues: Record<ReactionComponentRole, ReactionComponentDetails[]> = {
      reactant: componentsByRole.reactant.map(component => ({ ...component })),
      agent: componentsByRole.agent.map(component => ({ ...component })),
      product: componentsByRole.product.map(component => ({ ...component }))
    };

    const reactantMolecules = await Promise.all(reactants.map(smiles => this.parseMolecule(smiles)));
    const agentMolecules = await Promise.all(agents.map(smiles => this.parseMolecule(smiles)));
    const productMolecules = await Promise.all(products.map(smiles => this.parseMolecule(smiles)));

    const baseWidth = 320;
    const baseHeight = 220;
    const agentWidth = 280;
    const agentHeight = 200;

    const reactantSVGs = await Promise.all(
      reactantMolecules.map(async (mol, index) => {
        if (!mol) return null;

        const reactionCenter = reactionCenters.reactants[index];
        const customAtoms = reactionCenter?.atoms;
        const customBonds = reactionCenter?.bonds;

        return await this.buildHighlightedMoleculeSvg(
          mol.mol,
          'reactant',
          ROLE_PRESENTATION.reactant.color,
          baseWidth,
          baseHeight,
          labelQueues.reactant[index],
          customAtoms,
          customBonds
        );
      })
    );

    const agentSVGs = await Promise.all(
      agentMolecules.map(async (mol, index) => {
        if (!mol) return null;

        const reactionCenter = reactionCenters.agents[index];
        const customAtoms = reactionCenter?.atoms;
        const customBonds = reactionCenter?.bonds;

        return await this.buildHighlightedMoleculeSvg(
          mol.mol,
          'agent',
          ROLE_PRESENTATION.agent.color,
          agentWidth,
          agentHeight,
          labelQueues.agent[index],
          customAtoms,
          customBonds
        );
      })
    );

    const productSVGs = await Promise.all(
      productMolecules.map(async (mol, index) => {
        if (!mol) return null;

        const reactionCenter = reactionCenters.products[index];
        const customAtoms = reactionCenter?.atoms;
        const customBonds = reactionCenter?.bonds;

        return await this.buildHighlightedMoleculeSvg(
          mol.mol,
          'product',
          ROLE_PRESENTATION.product.color,
          baseWidth,
          baseHeight,
          labelQueues.product[index],
          customAtoms,
          customBonds
        );
      })
    );

    reactantMolecules.forEach(mol => mol && this.disposeMolecule(mol.mol));
    agentMolecules.forEach(mol => mol && this.disposeMolecule(mol.mol));
    productMolecules.forEach(mol => mol && this.disposeMolecule(mol.mol));

    const totalWidth = 1120;
    const totalHeight = 420;
    const reactionCenterY = 220;

    const scale = 0.92;
    const componentWidth = baseWidth * scale;
    const componentHeight = baseHeight * scale;

    const agentScale = 0.82;
    const agentComponentWidth = agentWidth * agentScale;
    const agentComponentHeight = agentHeight * agentScale;

    const reactantAreaCenterX = totalWidth * 0.28;
    const productAreaCenterX = totalWidth * 0.72;
    const agentAreaCenterX = totalWidth * 0.5;

    const computeSlotWidth = (count: number, baseValue: number) => {
      if (count <= 0) return baseValue;
      const areaWidth = totalWidth * 0.28;
      return Math.max(baseValue, areaWidth / count);
    };

    const reactantSlotWidth = computeSlotWidth(reactants.length, componentWidth + 24);
    const productSlotWidth = computeSlotWidth(products.length, componentWidth + 24);
    const agentSlotWidth = computeSlotWidth(agents.length || 1, agentComponentWidth + 16);

    const reactantBaseY = reactionCenterY - componentHeight / 2;
    const productBaseY = reactionCenterY - componentHeight / 2;
    const agentBaseY = reactionCenterY - agentComponentHeight - 80;
    const arrowY = reactionCenterY + componentHeight / 2 + 26;

    let svgContent = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect width="100%" height="100%" fill="white"/>`;

    const renderMoleculeGroup = (
      role: ReactionComponentRole,
      smiles: string,
      index: number,
      count: number,
      areaCenterX: number,
      slotDistance: number,
      baseY: number,
      componentW: number,
      componentH: number,
      scaleValue: number,
      svgArray: (string | null)[]
    ) => {
  const highlightInfo = labelQueues[role].shift();
      const styleInfo = ROLE_PRESENTATION[role];
      const centerX = areaCenterX + (index - (count - 1) / 2) * slotDistance;
      const topLeftX = centerX - componentW / 2;
      const labelPrimary = styleInfo.descriptor;
      const labelSecondary = highlightInfo?.label?.trim() || highlightInfo?.original?.trim() || smiles;

      const moleculeSvg = svgArray[index];
      if (moleculeSvg) {
        const svgMatch = moleculeSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
        if (svgMatch && svgMatch[1]) {
          svgContent += `<g transform="translate(${topLeftX}, ${baseY}) scale(${scaleValue})">${svgMatch[1]}</g>`;
        }
      } else {
        svgContent += `
          <g transform="translate(${topLeftX + componentW / 2}, ${baseY + componentH / 2})">
            <text text-anchor="middle" alignment-baseline="middle" fill="#1f2937" font-size="14" font-weight="600">
              ${role.toUpperCase()}
            </text>
          </g>
        `;
      }

      const labelY = baseY + componentH + 20;
      svgContent += `<text x="${centerX}" y="${labelY}" text-anchor="middle" font-size="13" font-weight="600" fill="${styleInfo.color}">${labelPrimary}</text>`;
      svgContent += `<text x="${centerX}" y="${labelY + 14}" text-anchor="middle" font-size="11" fill="#1e293b">${labelSecondary}</text>`;
    };

    reactants.forEach((smiles, index) => {
      renderMoleculeGroup(
        'reactant',
        smiles,
        index,
        reactants.length,
        reactantAreaCenterX,
        reactantSlotWidth,
        reactantBaseY,
        componentWidth,
        componentHeight,
        scale,
        reactantSVGs
      );
    });

    agents.forEach((smiles, index) => {
      renderMoleculeGroup(
        'agent',
        smiles,
        index,
        agents.length,
        agentAreaCenterX,
        agentSlotWidth,
        agentBaseY,
        agentComponentWidth,
        agentComponentHeight,
        agentScale,
        agentSVGs
      );
    });

    products.forEach((smiles, index) => {
      renderMoleculeGroup(
        'product',
        smiles,
        index,
        products.length,
        productAreaCenterX,
        productSlotWidth,
        productBaseY,
        componentWidth,
        componentHeight,
        scale,
        productSVGs
      );
    });

    if (options.includeArrow !== false) {
      svgContent += `
        <line x1="${reactantAreaCenterX + componentWidth / 2 + 48}" y1="${arrowY}" x2="${productAreaCenterX - componentWidth / 2 - 48}" y2="${arrowY}"
              stroke="#1f2937" stroke-width="5" stroke-linecap="round" />
        <polygon points="${productAreaCenterX - componentWidth / 2 - 48},${arrowY - 12}
                         ${productAreaCenterX - componentWidth / 2 - 48},${arrowY + 12}
                         ${productAreaCenterX - componentWidth / 2 + 8},${arrowY}"
                 fill="#1f2937" />
      `;
    }

    svgContent += '</svg>';
    return svgContent;
  }

  private combineSvgPanels(primarySvg: string, secondarySvg: string): string | null {
    const primaryMetrics = this.parseSvgDimensions(primarySvg);
    const secondaryMetrics = this.parseSvgDimensions(secondarySvg);

    if (!primaryMetrics || !secondaryMetrics) {
      return null;
    }

    const padding = 32;
    const gap = 40;
    const width = Math.max(primaryMetrics.width, secondaryMetrics.width) + padding * 2;
    const totalHeight = primaryMetrics.height + secondaryMetrics.height + gap + padding * 2;

    const primaryOffsetX = (width - primaryMetrics.width) / 2;
    const secondaryOffsetX = (width - secondaryMetrics.width) / 2;

    const sanitizedPrimary = this.stripXmlDeclaration(primarySvg);
    const sanitizedSecondary = this.stripXmlDeclaration(secondarySvg);

    return `
      <svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <g transform="translate(${primaryOffsetX}, ${padding})">
          ${sanitizedPrimary}
        </g>
        <g transform="translate(${secondaryOffsetX}, ${padding + primaryMetrics.height + gap})">
          ${sanitizedSecondary}
        </g>
      </svg>
    `;
  }

  private createStackedPreview(baseSvg: string | null, highlightSvg: string | null): string | null {
    if (!baseSvg) {
      return highlightSvg;
    }

    const baseSection = this.renderPrimaryPanel(baseSvg);
    const highlightSection = highlightSvg ? this.renderHighlightPanel(highlightSvg) : '';

    return `
      <div style="display:flex;flex-direction:column;gap:24px;align-items:center;padding:18px 16px 22px 16px;background:#f8fafc;">
        ${baseSection}
        ${highlightSection}
      </div>
    `;
  }

  private renderPrimaryPanel(svg: string): string {
    const sanitized = this.stripXmlDeclaration(svg);
    return `
      <div style="width:100%;max-width:960px;background:#ffffff;border-radius:14px;padding:20px;box-shadow:0 10px 28px rgba(15,23,42,0.12);display:flex;justify-content:center;">
        <div style="max-width:100%;overflow:auto;">${sanitized}</div>
      </div>
    `;
  }

  private renderHighlightPanel(svg: string): string {
    const sanitized = this.stripXmlDeclaration(svg);
    return `
      <div style="width:100%;max-width:960px;background:#ffffff;border-radius:12px;padding:16px 18px 20px 18px;box-shadow:0 6px 18px rgba(15,23,42,0.08);">
        <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:12px;letter-spacing:0.01em;">Highlighted Components</div>
        <div style="overflow:auto;max-width:100%;">${sanitized}</div>
      </div>
    `;
  }

  private normalizeSvgDimensions(svg: string, targetWidth = 960): string {
    const metrics = this.parseSvgDimensions(svg);
    if (!metrics) {
      return svg;
    }

    if (Math.abs(metrics.width - targetWidth) < 1) {
      return svg;
    }

    const scale = targetWidth / metrics.width;
    const targetHeight = Math.round(metrics.height * scale);

    let updatedSvg = svg;
    if (/width="[^"]*"/i.test(updatedSvg)) {
      updatedSvg = updatedSvg.replace(/width="[^"]*"/i, `width="${targetWidth}"`);
    } else {
      updatedSvg = updatedSvg.replace(/<svg/i, `<svg width="${targetWidth}"`);
    }

    if (/height="[^"]*"/i.test(updatedSvg)) {
      updatedSvg = updatedSvg.replace(/height="[^"]*"/i, `height="${targetHeight}"`);
    } else {
      updatedSvg = updatedSvg.replace(/<svg([^>]*)>/i, `<svg$1 height="${targetHeight}">`);
    }

    if (!/viewBox="[^"]*"/i.test(updatedSvg)) {
      updatedSvg = updatedSvg.replace(
        /<svg([^>]*)>/i,
        `<svg$1 viewBox="0 0 ${metrics.width} ${metrics.height}">`
      );
    }

    return updatedSvg;
  }

  private stripXmlDeclaration(svg: string): string {
    return svg.replace(/<\?xml[^>]*>/g, '').trim();
  }

  private parseSvgDimensions(svg: string): { width: number; height: number } | null {
    const widthMatch = svg.match(/width="([^"]+)"/i);
    const heightMatch = svg.match(/height="([^"]+)"/i);

    const parseDimension = (raw: string | undefined): number | null => {
      if (!raw) return null;
      const sanitized = raw.replace(/px/i, '').trim();
      const value = Number.parseFloat(sanitized);
      return Number.isFinite(value) ? value : null;
    };

    let width = parseDimension(widthMatch ? widthMatch[1] : undefined);
    let height = parseDimension(heightMatch ? heightMatch[1] : undefined);

    if (width !== null && height !== null) {
      return { width, height };
    }

    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1]
        .split(/\s+/)
        .map(part => Number.parseFloat(part))
        .filter(part => Number.isFinite(part));
      if (parts.length === 4) {
        return { width: parts[2], height: parts[3] };
      }
    }

    return null;
  }

  private async buildHighlightedMoleculeSvg(
    mol: JSMol,
    role: ReactionComponentRole,
    color: string,
    width: number,
    height: number,
    highlightSource?: ReactionComponentDetails,
    customAtoms?: number[],
    customBonds?: number[]
  ): Promise<string | null> {
    const baseSvg = await this.getSVG(mol, width, height);
    if (!baseSvg) {
      return null;
    }

    // Use custom atoms/bonds if provided, otherwise identify them
    const atoms = customAtoms || this.identifyKeyFunctionalAtoms(mol, role);
    const bonds = customBonds || this.identifyKeyFunctionalBonds(mol, role);

    if (!atoms.length && !bonds.length) {
      return baseSvg;
    }

    const highlightLabel =
      highlightSource?.label?.trim() ||
      highlightSource?.original?.trim() ||
      ROLE_PRESENTATION[role].descriptor;

    // Use RDKit's proper highlighting method
    if (typeof (mol as any).get_svg_with_highlights === 'function') {
      try {
        const highlightSpec = {
          atoms,
          bonds,
          legend: highlightLabel,
          legendColour: [0.06, 0.24, 0.42], // Dark blue for legend
          highlightColour: this.hexToUnitRgb(color),
          atomOpacity: 0.3,
          bondOpacity: 0.4,
          highlightBondWidthMultiplier: 1.5,
          continuousHighlight: true,
          fillHighlights: true
        };

        const highlightedSvg = (mol as any).get_svg_with_highlights(JSON.stringify(highlightSpec));
        if (typeof highlightedSvg === 'string' && highlightedSvg.trim().length > 0) {
          return highlightedSvg;
        }
      } catch (error) {
        console.warn('RDKit get_svg_with_highlights failed, falling back to CSS injection.', error);
      }
    }

    // Fallback to CSS-based highlighting
    return this.applyHighlightToSvg(baseSvg, { atoms, bonds }, color, highlightLabel);
  }

  private identifyHighlightElements(mol: JSMol, role: ReactionComponentRole): HighlightElements {
    if (!rdkit) {
      return { atoms: [], bonds: [] };
    }

    const patterns = HIGHLIGHT_SMARTS[role] ?? [];
    for (const smarts of patterns) {
      if (!smarts) continue;
      try {
        const query = rdkit.get_qmol(smarts);
        if (!query) {
          continue;
        }

        const matchRaw = mol.get_substruct_match(query);
        query.delete();

        if (matchRaw) {
          const parsed = JSON.parse(matchRaw);
          const atoms = this.normalizeIndexArray(parsed?.atoms ?? parsed);
          const bonds = this.normalizeIndexArray(parsed?.bonds);

          if (atoms.length > 0) {
            return { atoms, bonds };
          }
        }
      } catch (error) {
        console.warn(`Failed to evaluate highlight SMARTS "${smarts}"`, error);
      }
    }

    try {
      const getNumAtoms = (mol as unknown as { get_num_atoms?: () => number }).get_num_atoms;
      const totalAtoms = typeof getNumAtoms === 'function' ? Math.max(0, getNumAtoms.call(mol)) : 0;
      if (totalAtoms > 0) {
        const maxHighlight = Math.min(4, totalAtoms);
        return {
          atoms: Array.from({ length: maxHighlight }, (_, index) => index),
          bonds: []
        };
      }
    } catch (error) {
      console.warn('Unable to derive fallback highlight atoms.', error);
    }

    return { atoms: [], bonds: [] };
  }

  private normalizeIndexArray(value: unknown): number[] {
    if (!value) {
      return [];
    }

    const sourceArray = Array.isArray(value) ? value : Array.isArray((value as any)?.atoms) ? (value as any).atoms : [];
    if (!Array.isArray(sourceArray)) {
      return [];
    }

    return sourceArray
      .map(index => Number(index))
      .filter(index => Number.isFinite(index) && index >= 0);
  }

  private hexToUnitRgb(color: string): [number, number, number] {
    const sanitized = color.replace('#', '').trim();

    const expand = (segment: string): string => (segment.length === 1 ? segment.repeat(2) : segment);

    const segments = sanitized.length === 3
      ? sanitized.split('').map(expand)
      : sanitized.match(/.{1,2}/g) ?? ['00', '00', '00'];

    const [rHex, gHex, bHex] = [segments[0] ?? '00', segments[1] ?? '00', segments[2] ?? '00'];
    const r = Number.parseInt(rHex, 16) / 255;
    const g = Number.parseInt(gHex, 16) / 255;
    const b = Number.parseInt(bHex, 16) / 255;

    return [Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0];
  }

  private applyHighlightToSvg(svg: string, highlight: HighlightElements, color: string, legend?: string | null): string {
    if (!highlight.atoms.length && !highlight.bonds.length) {
      return svg;
    }

    const highlightCssSections: string[] = [];

    highlightCssSections.push(
      highlight.atoms
      .map((atomIndex) => `
        .atom-${atomIndex} {
          fill: ${color};
          fill-opacity: 0.24;
          stroke: ${color};
          stroke-width: 1.6;
        }
        path[class*="atom-${atomIndex}"] {
          stroke: ${color};
          stroke-width: 1.4;
          filter: drop-shadow(0 0 4px ${color}55);
        }
        text[class*="atom-${atomIndex}"] {
          fill: #0f172a;
        }
      `)
      .join('\n')
    );

    if (highlight.bonds.length) {
      highlightCssSections.push(
        highlight.bonds
          .map(
            (bondIndex) => `
              path[class*="bond-${bondIndex}"] {
                stroke: ${color};
                stroke-width: 2.4;
              }
            `
          )
          .join('\n')
      );
    }

    const highlightCss = highlightCssSections.filter(Boolean).join('\n');

    if (!highlightCss.trim()) {
      return svg;
    }

    const styleTag = `<style>${highlightCss}</style>`;
    let svgWithStyle = svg.replace(/(<svg[^>]*>)/, `$1${styleTag}`);

    if (legend) {
      const legendText = legend.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      svgWithStyle = svgWithStyle.replace(
        /(<\/svg>)$/,
        `<text x="50%" y="92%" text-anchor="middle" font-size="12" fill="#0f172a">${legendText}</text>$1`
      );
    }

    return svgWithStyle;
  }
}

export const rdkitService = RDKitService.getInstance();
