const nodesApi = {
    getAllNodes: () => Promise.resolve({
        data: [
            {
                name: 'moleculeSearch',
                type: 'Molecule Search',
                category: 'Chemistry',
                description: 'Search for molecules by name, SMILES, or CAS number',
                icon: '🔬',
                inputs: [
                    { name: 'query', type: 'string', label: 'Search Query' }
                ],
                outputs: [
                    { name: 'molecules', type: 'array', label: 'Molecule Data' }
                ]
            },
            {
                name: 'reactionPredictor',
                type: 'Reaction Predictor',
                category: 'Chemistry',
                description: 'Predict chemical reactions from reactants',
                icon: '⚗️',
                inputs: [
                    { name: 'reactants', type: 'string', label: 'Reactants (SMILES)' }
                ],
                outputs: [
                    { name: 'products', type: 'array', label: 'Predicted Products' }
                ]
            },
            {
                name: 'propertyCalculator',
                type: 'Property Calculator',
                category: 'Chemistry',
                description: 'Calculate molecular properties',
                icon: '📊',
                inputs: [
                    { name: 'molecule', type: 'string', label: 'Molecule (SMILES)' }
                ],
                outputs: [
                    { name: 'properties', type: 'object', label: 'Molecular Properties' }
                ]
            },
            {
                name: 'textAnalyzer',
                type: 'Text Analyzer',
                category: 'AI',
                description: 'Analyze chemical text and extract information',
                icon: '📝',
                inputs: [
                    { name: 'text', type: 'string', label: 'Text Input' }
                ],
                outputs: [
                    { name: 'analysis', type: 'object', label: 'Analysis Results' }
                ]
            },
            {
                name: 'dataProcessor',
                type: 'Data Processor',
                category: 'Utilities',
                description: 'Process and transform chemical data',
                icon: '🔄',
                inputs: [
                    { name: 'data', type: 'any', label: 'Input Data' }
                ],
                outputs: [
                    { name: 'processed', type: 'any', label: 'Processed Data' }
                ]
            },
            {
                name: 'fileReader',
                type: 'File Reader',
                category: 'Input/Output',
                description: 'Read data from files (CSV, SDF, etc.)',
                icon: '📁',
                inputs: [
                    { name: 'file', type: 'file', label: 'Input File' }
                ],
                outputs: [
                    { name: 'data', type: 'array', label: 'File Data' }
                ]
            },
            {
                name: 'visualizer',
                type: 'Visualizer',
                category: 'Output',
                description: 'Create visualizations of chemical data',
                icon: '📈',
                inputs: [
                    { name: 'data', type: 'any', label: 'Data to Visualize' }
                ],
                outputs: [
                    { name: 'chart', type: 'image', label: 'Visualization' }
                ]
            }
        ]
    })
};

export default nodesApi;
