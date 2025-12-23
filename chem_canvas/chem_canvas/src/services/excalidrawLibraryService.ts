/**
 * Excalidraw External Library Service
 * Provides functionality to fetch, search, and load library items from Excalidraw's library ecosystem
 */

import { loadLibraryFromBlob } from '@excalidraw/excalidraw';

// Define library item types
export interface LibraryItem {
    id: string;
    status: 'published' | 'unpublished';
    elements: any[];
    name?: string;
}

export type LibraryItems = LibraryItem[];

// Base URL for GitHub raw content
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries';

// Library catalog with actual GitHub paths from the repository
const LIBRARY_CATALOG: Record<string, { name: string; keywords: string[]; source: string }> = {
    'software-architecture': {
        name: 'Software Architecture',
        keywords: ['architecture', 'microservice', 'database', 'cache', 'server', 'browser', 'mobile', 'pipeline', 'api'],
        source: 'youritjang/software-architecture.excalidrawlib',
    },
    'computers': {
        name: 'Computers',
        keywords: ['computer', 'laptop', 'desktop', 'pc', 'server', 'cpu', 'monitor'],
        source: 'ei-au/computers.excalidrawlib',
    },
    'azure': {
        name: 'Azure Cloud Services',
        keywords: ['azure', 'cloud', 'vm', 'storage', 'database', 'network', 'devops', 'microsoft'],
        source: 'youritjang/azure-cloud-services.excalidrawlib',
    },
    'it-logos': {
        name: 'IT Logos',
        keywords: ['logo', 'react', 'angular', 'vue', 'node', 'javascript', 'python', 'java', 'docker', 'kubernetes'],
        source: 'pclainchard/it-logos.excalidrawlib',
    },
    'forms': {
        name: 'Forms',
        keywords: ['form', 'input', 'button', 'checkbox', 'radio', 'select', 'text', 'field'],
        source: 'g-script/forms.excalidrawlib',
    },
    'charts': {
        name: 'Charts',
        keywords: ['chart', 'graph', 'bar', 'pie', 'line', 'column', 'data', 'visualization'],
        source: 'g-script/charts.excalidrawlib',
    },
    'flowchart': {
        name: 'Information Architecture',
        keywords: ['flowchart', 'flow', 'decision', 'process', 'page', 'branch', 'condition'],
        source: 'inwardmovement/information-architecture.excalidrawlib',
    },
    'data-viz': {
        name: 'Data Visualization',
        keywords: ['visualization', 'analytics', 'metrics', 'dashboard', 'report'],
        source: 'dbssticky/data-viz.excalidrawlib',
    },
    'gadgets': {
        name: 'Gadgets',
        keywords: ['phone', 'smartphone', 'tablet', 'watch', 'smartwatch', 'mp3', 'gadget', 'device'],
        source: 'morgemoensch/gadgets.excalidrawlib',
    },
    'raspberry-pi': {
        name: 'Raspberry Pi',
        keywords: ['raspberry', 'pi', 'gpio', 'board', 'electronics', 'embedded', 'iot'],
        source: 'revolunet/raspberrypi3.excalidrawlib',
    },
    'android': {
        name: 'Android Components',
        keywords: ['android', 'mobile', 'app', 'ui', 'component', 'material'],
        source: 'g-script/android.excalidrawlib',
    },
};

// Cache for loaded libraries
const libraryCache: Map<string, LibraryItems> = new Map();

/**
 * Find the best matching library category based on user request
 */
export function findLibraryCategory(request: string): string | null {
    const lowerRequest = request.toLowerCase();

    for (const [category, info] of Object.entries(LIBRARY_CATALOG)) {
        for (const keyword of info.keywords) {
            if (lowerRequest.includes(keyword)) {
                console.log(`[LibraryService] Matched category "${category}" for keyword "${keyword}"`);
                return category;
            }
        }
    }

    return null;
}

/**
 * Fetch a library from the Excalidraw library repository on GitHub
 */
export async function fetchLibrary(category: string): Promise<LibraryItems | null> {
    // Check cache first
    if (libraryCache.has(category)) {
        console.log(`[LibraryService] Using cached library: ${category}`);
        return libraryCache.get(category)!;
    }

    const libraryInfo = LIBRARY_CATALOG[category];
    if (!libraryInfo) {
        console.warn(`[LibraryService] Unknown library category: ${category}`);
        return null;
    }

    const url = `${GITHUB_RAW_BASE}/${libraryInfo.source}`;

    try {
        console.log(`[LibraryService] Fetching library: ${category} from ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const items = await loadLibraryFromBlob(blob, 'published') as any;

        // Cache the result
        libraryCache.set(category, items);
        console.log(`[LibraryService] Loaded ${items.length} items from ${category}`);

        return items;
    } catch (error) {
        console.error(`[LibraryService] Failed to fetch library ${category}:`, error);
        return null;
    }
}

/**
 * Search for a specific item within a library
 */
export function searchLibrary(items: LibraryItems, searchTerm: string): LibraryItem | null {
    const lowerSearch = searchTerm.toLowerCase();

    const exactMatch = items.find(item => item.name?.toLowerCase() === lowerSearch);
    if (exactMatch) return exactMatch;

    const partialMatch = items.find(item => item.name?.toLowerCase().includes(lowerSearch));
    if (partialMatch) return partialMatch;

    return items.length > 0 ? items[0] : null;
}

/**
 * Get all available library categories
 */
export function getLibraryCatalog(): { category: string; name: string; keywords: string[] }[] {
    return Object.entries(LIBRARY_CATALOG).map(([category, info]) => ({
        category,
        name: info.name,
        keywords: info.keywords,
    }));
}

/**
 * Preload commonly used libraries
 */
export async function preloadLibraries(categories: string[] = ['software-architecture', 'charts']): Promise<void> {
    console.log('[LibraryService] Preloading libraries:', categories);
    await Promise.all(categories.map(category => fetchLibrary(category).catch(err => {
        console.warn(`[LibraryService] Failed to preload ${category}:`, err);
    })));
}

/**
 * Create embedded diagram elements for common requests
 * These are always available without network calls
 */
export function createFallbackElements(request: string): any[] | null {
    const lowerRequest = request.toLowerCase();
    const now = Date.now();

    // Circuit/Electronics elements
    if (lowerRequest.includes('circuit') || lowerRequest.includes('resistor') || lowerRequest.includes('capacitor')) {
        return [
            { id: `r-${now}-1`, type: 'rectangle', x: 100, y: 100, width: 60, height: 20, strokeColor: '#1e1e1e', backgroundColor: 'transparent', strokeWidth: 2, roughness: 0 },
            { id: `l-${now}-2`, type: 'line', x: 40, y: 110, width: 60, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [60, 0]] },
            { id: `l-${now}-3`, type: 'line', x: 160, y: 110, width: 60, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [60, 0]] },
            { id: `t-${now}-4`, type: 'text', x: 110, y: 130, text: 'Resistor', fontSize: 14, fontFamily: 1 },
        ];
    }

    // Op-amp / Amplifier
    if (lowerRequest.includes('op-amp') || lowerRequest.includes('opamp') || lowerRequest.includes('amplifier')) {
        return [
            { id: `tri-${now}-1`, type: 'line', x: 100, y: 50, width: 80, height: 60, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [80, 30], [0, 60], [0, 0]] },
            { id: `l-${now}-2`, type: 'line', x: 60, y: 65, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `l-${now}-3`, type: 'line', x: 60, y: 95, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `l-${now}-4`, type: 'line', x: 180, y: 80, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `t-${now}-5`, type: 'text', x: 105, y: 120, text: 'Op-Amp', fontSize: 14, fontFamily: 1 },
        ];
    }

    // Transistor
    if (lowerRequest.includes('transistor') || lowerRequest.includes('bjt') || lowerRequest.includes('mosfet')) {
        return [
            { id: `l-${now}-1`, type: 'line', x: 100, y: 50, width: 0, height: 60, strokeColor: '#1e1e1e', strokeWidth: 3, points: [[0, 0], [0, 60]] },
            { id: `l-${now}-2`, type: 'line', x: 60, y: 80, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `l-${now}-3`, type: 'line', x: 100, y: 60, width: 40, height: -30, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, -30]] },
            { id: `l-${now}-4`, type: 'line', x: 100, y: 100, width: 40, height: 30, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 30]] },
            { id: `t-${now}-5`, type: 'text', x: 85, y: 140, text: 'Transistor', fontSize: 14, fontFamily: 1 },
        ];
    }

    // LED / Diode
    if (lowerRequest.includes('led') || lowerRequest.includes('diode')) {
        return [
            { id: `tri-${now}-1`, type: 'line', x: 100, y: 70, width: 30, height: 40, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [30, 20], [0, 40], [0, 0]] },
            { id: `l-${now}-2`, type: 'line', x: 130, y: 70, width: 0, height: 40, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [0, 40]] },
            { id: `l-${now}-3`, type: 'line', x: 60, y: 90, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `l-${now}-4`, type: 'line', x: 130, y: 90, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `t-${now}-5`, type: 'text', x: 95, y: 120, text: 'LED/Diode', fontSize: 14, fontFamily: 1 },
        ];
    }

    // Battery
    if (lowerRequest.includes('battery') || lowerRequest.includes('power source') || lowerRequest.includes('voltage source')) {
        return [
            { id: `l-${now}-1`, type: 'line', x: 100, y: 70, width: 0, height: 40, strokeColor: '#1e1e1e', strokeWidth: 3, points: [[0, 0], [0, 40]] },
            { id: `l-${now}-2`, type: 'line', x: 120, y: 80, width: 0, height: 20, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [0, 20]] },
            { id: `l-${now}-3`, type: 'line', x: 60, y: 90, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `l-${now}-4`, type: 'line', x: 120, y: 90, width: 40, height: 0, strokeColor: '#1e1e1e', strokeWidth: 2, points: [[0, 0], [40, 0]] },
            { id: `t-${now}-5`, type: 'text', x: 90, y: 120, text: 'Battery', fontSize: 14, fontFamily: 1 },
        ];
    }

    // Computer/Server
    if (lowerRequest.includes('computer') || lowerRequest.includes('server') || lowerRequest.includes('laptop')) {
        return [
            { id: `r-${now}-1`, type: 'rectangle', x: 100, y: 50, width: 120, height: 80, strokeColor: '#1e1e1e', backgroundColor: '#e6e6e6', strokeWidth: 2, roughness: 0 },
            { id: `r-${now}-2`, type: 'rectangle', x: 110, y: 60, width: 100, height: 60, strokeColor: '#1e1e1e', backgroundColor: '#4a90d9', strokeWidth: 1, roughness: 0 },
            { id: `r-${now}-3`, type: 'rectangle', x: 100, y: 135, width: 120, height: 10, strokeColor: '#1e1e1e', backgroundColor: '#cccccc', strokeWidth: 2, roughness: 0 },
            { id: `t-${now}-4`, type: 'text', x: 130, y: 155, text: 'Computer', fontSize: 14, fontFamily: 1 },
        ];
    }

    // Database
    if (lowerRequest.includes('database') || lowerRequest.includes('db') || lowerRequest.includes('storage')) {
        return [
            { id: `e-${now}-1`, type: 'ellipse', x: 100, y: 50, width: 80, height: 30, strokeColor: '#1e1e1e', backgroundColor: '#a8d8ea', strokeWidth: 2, roughness: 0 },
            { id: `r-${now}-2`, type: 'rectangle', x: 100, y: 65, width: 80, height: 50, strokeColor: '#1e1e1e', backgroundColor: '#a8d8ea', strokeWidth: 2, roughness: 0 },
            { id: `e-${now}-3`, type: 'ellipse', x: 100, y: 100, width: 80, height: 30, strokeColor: '#1e1e1e', backgroundColor: '#a8d8ea', strokeWidth: 2, roughness: 0 },
            { id: `t-${now}-4`, type: 'text', x: 115, y: 140, text: 'Database', fontSize: 14, fontFamily: 1 },
        ];
    }

    return null;
}
