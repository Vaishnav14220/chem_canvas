// Chemistry Structure Recognition and Conversion Service
export interface ChemistryStructure {
  id: string;
  type: 'molecule' | 'reaction' | 'ion' | 'complex';
  atoms: Atom[];
  bonds: Bond[];
  metadata: {
    name?: string;
    formula?: string;
    smiles?: string;
    inchi?: string;
  };
}

export interface Atom {
  id: string;
  element: string;
  x: number;
  y: number;
  charge?: number;
  isotope?: number;
  hybridization?: 'sp' | 'sp2' | 'sp3' | 'aromatic';
}

export interface Bond {
  id: string;
  from: string;
  to: string;
  type: 'single' | 'double' | 'triple' | 'aromatic' | 'ionic';
  stereo?: 'cis' | 'trans' | 'e' | 'z';
}

export interface ConversionResult {
  success: boolean;
  structure?: ChemistryStructure;
  error?: string;
  suggestions?: string[];
  confidence: number;
}

// Convert canvas drawing to chemistry structure
export const convertCanvasToChemistry = async (
  canvasData: string,
  apiKey: string
): Promise<ConversionResult> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert chemistry structure recognition AI. Analyze this hand-drawn chemistry diagram and convert it into a structured chemistry representation.

TASK: Convert the hand-drawn chemistry structure into a professional chemistry format.

ANALYSIS CRITERIA:
1. Identify atoms and their positions
2. Recognize chemical bonds (single, double, triple, aromatic)
3. Detect functional groups
4. Identify reaction arrows and mechanisms
5. Recognize ionic charges and lone pairs
6. Determine molecular geometry and stereochemistry

RESPONSE FORMAT:
You MUST return ONLY a valid JSON object with this exact structure:

{
  "success": true,
  "structure": {
    "id": "structure-1",
    "type": "molecule",
    "atoms": [
      {
        "id": "atom-1",
        "element": "C",
        "x": 100,
        "y": 100,
        "charge": 0,
        "hybridization": "sp3"
      }
    ],
    "bonds": [
      {
        "id": "bond-1",
        "from": "atom-1",
        "to": "atom-2",
        "type": "single",
        "stereo": null
      }
    ],
    "metadata": {
      "name": "Methane",
      "formula": "CH4",
      "smiles": "C",
      "inchi": "InChI=1S/CH4/h1H4"
    }
  },
  "confidence": 0.95,
  "suggestions": [
    "Consider adding hydrogen atoms for clarity",
    "Double-check bond angles for proper geometry"
  ]
}

IMPORTANT: 
- Return valid JSON only, no markdown formatting
- Use standard chemistry notation
- Include SMILES and InChI when possible
- Provide confidence score (0-1)
- Give helpful suggestions for improvement

Analyze the image and provide the most accurate chemistry structure representation.`
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: canvasData.split(',')[1]
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    try {
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();
      
      const result = JSON.parse(cleanedText);
      
      // Add unique IDs if missing
      if (result.structure) {
        result.structure.atoms = result.structure.atoms.map((atom: any, index: number) => ({
          ...atom,
          id: atom.id || `atom-${index + 1}`
        }));
        
        result.structure.bonds = result.structure.bonds.map((bond: any, index: number) => ({
          ...bond,
          id: bond.id || `bond-${index + 1}`
        }));
      }

      return result;
    } catch (parseError) {
      console.error('Failed to parse chemistry conversion response:', parseError);
      
      return {
        success: false,
        error: "Failed to parse chemistry structure. Please try drawing more clearly.",
        confidence: 0,
        suggestions: [
          "Draw atoms as clear circles",
          "Make bonds as straight lines",
          "Label elements clearly",
          "Use standard chemistry notation"
        ]
      };
    }
  } catch (error) {
    console.error('Chemistry conversion error:', error);
    
    return {
      success: false,
      error: "Failed to convert chemistry structure. Please check your API key and internet connection.",
      confidence: 0,
      suggestions: [
        "Check your Gemini API key in settings",
        "Ensure you have a stable internet connection",
        "Try drawing a simpler structure first"
      ]
    };
  }
};

// Generate SMILES notation from structure
export const generateSMILES = (structure: ChemistryStructure): string => {
  // This is a simplified SMILES generator
  // In a real implementation, you'd use a proper chemistry library
  if (structure.metadata.smiles) {
    return structure.metadata.smiles;
  }
  
  // Basic SMILES generation based on atoms and bonds
  const atoms = structure.atoms;
  const bonds = structure.bonds;
  
  if (atoms.length === 1) {
    return atoms[0].element;
  }
  
  // Simple linear chain detection
  const connectedAtoms = new Map<string, string[]>();
  bonds.forEach(bond => {
    if (!connectedAtoms.has(bond.from)) {
      connectedAtoms.set(bond.from, []);
    }
    if (!connectedAtoms.has(bond.to)) {
      connectedAtoms.set(bond.to, []);
    }
    connectedAtoms.get(bond.from)!.push(bond.to);
    connectedAtoms.get(bond.to)!.push(bond.from);
  });
  
  // Find a starting atom (one with only one connection)
  let startAtom = atoms.find(atom => 
    (connectedAtoms.get(atom.id) || []).length === 1
  );
  
  if (!startAtom) {
    startAtom = atoms[0];
  }
  
  const visited = new Set<string>();
  const smiles: string[] = [];
  
  const traverse = (atomId: string) => {
    if (visited.has(atomId)) return;
    
    visited.add(atomId);
    const atom = atoms.find(a => a.id === atomId);
    if (atom) {
      smiles.push(atom.element);
      
      const connections = connectedAtoms.get(atomId) || [];
      connections.forEach(connectedId => {
        if (!visited.has(connectedId)) {
          const bond = bonds.find(b => 
            (b.from === atomId && b.to === connectedId) ||
            (b.to === atomId && b.from === connectedId)
          );
          
          if (bond) {
            if (bond.type === 'double') smiles.push('=');
            else if (bond.type === 'triple') smiles.push('#');
            else if (bond.type === 'aromatic') smiles.push(':');
            
            traverse(connectedId);
          }
        }
      });
    }
  };
  
  traverse(startAtom.id);
  return smiles.join('');
};

// Generate molecular formula
export const generateFormula = (structure: ChemistryStructure): string => {
  const elementCounts = new Map<string, number>();
  
  structure.atoms.forEach(atom => {
    const count = elementCounts.get(atom.element) || 0;
    elementCounts.set(atom.element, count + 1);
  });
  
  // Sort elements by standard order (C, H, then alphabetical)
  const elementOrder = ['C', 'H', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'];
  const sortedElements = Array.from(elementCounts.entries()).sort((a, b) => {
    const aIndex = elementOrder.indexOf(a[0]);
    const bIndex = elementOrder.indexOf(b[0]);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
  
  return sortedElements
    .map(([element, count]) => count === 1 ? element : `${element}${count}`)
    .join('');
};

// Validate chemistry structure
export const validateStructure = (structure: ChemistryStructure): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for duplicate atom IDs
  const atomIds = structure.atoms.map(atom => atom.id);
  const uniqueAtomIds = new Set(atomIds);
  if (atomIds.length !== uniqueAtomIds.size) {
    errors.push("Duplicate atom IDs found");
  }
  
  // Check for invalid bonds
  structure.bonds.forEach(bond => {
    const fromAtom = structure.atoms.find(atom => atom.id === bond.from);
    const toAtom = structure.atoms.find(atom => atom.id === bond.to);
    
    if (!fromAtom) {
      errors.push(`Bond ${bond.id} references non-existent atom ${bond.from}`);
    }
    if (!toAtom) {
      errors.push(`Bond ${bond.id} references non-existent atom ${bond.to}`);
    }
  });
  
  // Check for valid elements
  const validElements = [
    'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
    'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
    'Fe', 'Cu', 'Zn', 'Br', 'I'
  ];
  
  structure.atoms.forEach(atom => {
    if (!validElements.includes(atom.element)) {
      errors.push(`Invalid element: ${atom.element}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};
