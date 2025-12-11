/**
 * Pre-computed multi-frame XYZ animations for common reactions
 * These are like ChemTube3D's pre-computed mechanism animations
 * Each frame shows atoms at different positions along the reaction coordinate
 */

// SN2 Reaction: CH3Br + OH- → CH3OH + Br-
// Nucleophile (OH-) attacks from backside, Br- leaves from opposite side
export const SN2_ANIMATION = `7
Frame 1 - Reactants separated
C   0.000  0.000  0.000
H   1.000  0.000  0.000
H  -0.500  0.866  0.000
H  -0.500 -0.866  0.000
Br  2.800  0.000  0.000
O  -4.000  0.000  0.000
H  -4.600  0.600  0.000
7
Frame 2 - Nucleophile approaching
C   0.000  0.000  0.000
H   1.000  0.000  0.000
H  -0.500  0.866  0.000
H  -0.500 -0.866  0.000
Br  2.600  0.000  0.000
O  -3.200  0.000  0.000
H  -3.800  0.600  0.000
7
Frame 3 - Transition state forming
C   0.000  0.000  0.000
H   0.800  0.400  0.200
H  -0.300  0.900  0.100
H  -0.300 -0.900  0.100
Br  2.200  0.000  0.000
O  -2.200  0.000  0.000
H  -2.800  0.600  0.000
7
Frame 4 - Transition state (pentacoordinate)
C   0.000  0.000  0.000
H   0.500  0.700  0.400
H   0.000  0.900 -0.300
H   0.000 -0.900 -0.300
Br  1.800  0.000  0.000
O  -1.800  0.000  0.000
H  -2.400  0.600  0.000
7
Frame 5 - Bond breaking
C   0.000  0.000  0.000
H   0.200  0.800  0.500
H   0.200  0.800 -0.500
H   0.200 -0.900  0.000
Br  2.400  0.000  0.000
O  -1.500  0.000  0.000
H  -2.100  0.600  0.000
7
Frame 6 - Products forming
C   0.000  0.000  0.000
H   0.600  0.800  0.400
H   0.600  0.400 -0.800
H   0.600 -0.800  0.000
Br  3.200  0.000  0.000
O  -1.200  0.000  0.000
H  -1.600  0.700  0.000
7
Frame 7 - Products separated
C   0.000  0.000  0.000
H   0.800  0.600  0.400
H   0.800  0.200 -0.700
H   0.800 -0.600  0.000
Br  4.000  0.000  0.000
O  -1.000  0.000  0.000
H  -1.400  0.700  0.000
`;

// Diels-Alder Reaction: Diene + Dienophile → Cyclohexene
export const DIELS_ALDER_ANIMATION = `10
Frame 1 - Reactants separated
C  -1.200  0.700  2.500
C  -1.200 -0.700  2.500
C   0.000  1.400  2.500
C   0.000 -1.400  2.500
C   1.500  0.000 -2.000
C   1.500  0.000 -0.800
H  -2.100  1.200  2.500
H  -2.100 -1.200  2.500
H   2.300  0.000 -2.600
H   2.300  0.000 -0.200
10
Frame 2 - Approaching
C  -1.200  0.700  1.800
C  -1.200 -0.700  1.800
C   0.000  1.400  1.800
C   0.000 -1.400  1.800
C   1.200  0.000 -1.500
C   1.200  0.000 -0.500
H  -2.100  1.200  1.800
H  -2.100 -1.200  1.800
H   2.000  0.000 -2.100
H   2.000  0.000  0.100
10
Frame 3 - Closer approach
C  -1.000  0.700  1.200
C  -1.000 -0.700  1.200
C   0.100  1.200  1.000
C   0.100 -1.200  1.000
C   0.900  0.000 -0.800
C   0.900  0.000  0.200
H  -1.900  1.200  1.200
H  -1.900 -1.200  1.200
H   1.700  0.000 -1.400
H   1.700  0.000  0.800
10
Frame 4 - Transition state
C  -0.700  0.700  0.600
C  -0.700 -0.700  0.600
C   0.300  1.000  0.400
C   0.300 -1.000  0.400
C   0.600  0.000 -0.300
C   0.600  0.000  0.500
H  -1.600  1.200  0.600
H  -1.600 -1.200  0.600
H   1.400  0.000 -0.900
H   1.400  0.000  1.100
10
Frame 5 - Bond forming
C  -0.500  0.700  0.200
C  -0.500 -0.700  0.200
C   0.500  0.800  0.000
C   0.500 -0.800  0.000
C   0.400  0.000 -0.100
C   0.400  0.000  0.400
H  -1.400  1.200  0.200
H  -1.400 -1.200  0.200
H   1.200  0.000 -0.700
H   1.200  0.000  1.000
10
Frame 6 - Product (cyclohexene)
C  -0.400  0.700  0.000
C  -0.400 -0.700  0.000
C   0.600  0.700  0.000
C   0.600 -0.700  0.000
C   0.300  0.000  0.000
C   0.300  0.000  0.300
H  -1.300  1.200  0.000
H  -1.300 -1.200  0.000
H   1.100  0.000 -0.600
H   1.100  0.000  0.900
`;

// E2 Elimination: CH3CH2Br + Base → CH2=CH2 + HBr
export const E2_ELIMINATION_ANIMATION = `9
Frame 1 - Reactants
C   0.000  0.000  0.000
C   1.500  0.000  0.000
H  -0.500  0.866  0.000
H  -0.500 -0.866  0.000
H   2.000  0.866  0.000
Br  2.800  0.000  0.000
O  -3.500  0.000  0.000
H  -4.100  0.600  0.000
H   1.600  0.000 -1.000
9
Frame 2 - Base approaching beta-H
C   0.000  0.000  0.000
C   1.500  0.000  0.000
H  -0.500  0.866  0.000
H  -0.500 -0.866  0.000
H   2.000  0.866  0.000
Br  2.800  0.000  0.000
O  -2.800  0.600  0.000
H  -3.400  1.200  0.000
H   1.600  0.000 -1.000
9
Frame 3 - H abstraction begins
C   0.000  0.000  0.000
C   1.400  0.000  0.000
H  -0.400  0.866  0.000
H  -1.000  0.000  0.000
H   1.900  0.866  0.000
Br  2.900  0.000  0.000
O  -2.000  0.800  0.000
H  -2.600  1.400  0.000
H   1.500  0.000 -1.200
9
Frame 4 - Transition state
C   0.000  0.000  0.000
C   1.350  0.000  0.000
H  -0.300  0.866  0.000
H  -1.400  0.200  0.000
H   1.800  0.866  0.000
Br  3.200  0.000  0.000
O  -1.800  0.900  0.000
H  -2.400  1.500  0.000
H   1.400  0.000 -1.400
9
Frame 5 - Double bond forming
C   0.000  0.000  0.000
C   1.340  0.000  0.000
H  -0.200  0.866  0.000
H  -1.800  0.400  0.000
H   1.700  0.866  0.000
Br  3.600  0.000  0.000
O  -1.600  1.000  0.000
H  -2.200  1.600  0.000
H   1.300  0.000 -1.600
9
Frame 6 - Products
C   0.000  0.000  0.000
C   1.340  0.000  0.000
H  -0.100  0.866  0.000
H  -2.200  0.600  0.000
H   1.600  0.866  0.000
Br  4.000  0.000  0.000
O  -1.400  1.100  0.000
H  -2.000  1.700  0.000
H   1.200  0.000 -1.800
`;

export const MECHANISM_TEMPLATES: Record<string, { name: string; animation: string; description: string }> = {
    'sn2': {
        name: 'SN2 Reaction',
        animation: SN2_ANIMATION,
        description: 'Nucleophilic substitution - backside attack by OH-, Br- leaves'
    },
    'diels-alder': {
        name: 'Diels-Alder',
        animation: DIELS_ALDER_ANIMATION,
        description: 'Cycloaddition - diene and dienophile form cyclohexene ring'
    },
    'e2': {
        name: 'E2 Elimination',
        animation: E2_ELIMINATION_ANIMATION,
        description: 'Base abstracts beta-H, double bond forms, leaving group departs'
    }
};

/**
 * Find a matching pre-computed mechanism animation for a reaction query
 */
export const findMechanismTemplate = (query: string): { animation: string; description: string } | null => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('sn2') || lowerQuery.includes('nucleophilic substitution')) {
        return MECHANISM_TEMPLATES['sn2'];
    }

    if (lowerQuery.includes('diels') || lowerQuery.includes('alder') || lowerQuery.includes('cycloaddition')) {
        return MECHANISM_TEMPLATES['diels-alder'];
    }

    if (lowerQuery.includes('e2') || lowerQuery.includes('elimination')) {
        return MECHANISM_TEMPLATES['e2'];
    }

    return null;
};
