/**
 * ConceptMapDrawIO - Concept Map visualization using Draw.io
 * 
 * Converts lab manual analysis topics and concept graphs into
 * interactive Draw.io diagrams that users can edit and expand.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DrawIoEmbed } from 'react-drawio';
import type { DrawIoEmbedRef } from 'react-drawio';
import { Loader2, RefreshCw, Download, ZoomIn, Maximize2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Topic {
    name: string;
    summary: string;
    keywords: string[];
    subtopics?: Topic[];
}

interface ConceptEdge {
    from: string;
    to: string;
    type: 'subtopic' | 'uses' | 'related';
}

interface ConceptMapDrawIOProps {
    title: string;
    topics: Topic[];
    conceptEdges?: ConceptEdge[];
    devices?: { name: string; role: string }[];
    onTopicClick?: (topic: Topic) => void;
}

// ============================================================================
// XML Generation Utilities
// ============================================================================

/**
 * Generate Draw.io mxGraph XML from topics and concept edges
 */
function generateConceptMapXML(
    title: string,
    topics: Topic[],
    devices?: { name: string; role: string }[],
    conceptEdges?: ConceptEdge[]
): string {
    let cellId = 2;
    const cells: string[] = [];
    const nodePositions = new Map<string, { x: number; y: number; id: number }>();

    // Layout constants
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 60;
    const H_SPACING = 200;
    const V_SPACING = 120;
    const START_X = 80;
    const START_Y = 40;

    // Generate unique ID
    const nextId = () => cellId++;

    // Helper to escape XML
    const escapeXml = (str: string) => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // Create title node
    const titleId = nextId();
    cells.push(`
        <mxCell id="${titleId}" value="${escapeXml(title)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1a365d;strokeColor=#2c5282;fontColor=#ffffff;fontSize=16;fontStyle=1;shadow=1;arcSize=20;" vertex="1" parent="1">
            <mxGeometry x="${START_X + 200}" y="${START_Y}" width="280" height="50" as="geometry"/>
        </mxCell>
    `);

    // Position topics in a hierarchical layout
    let currentRow = 0;
    let currentCol = 0;
    const maxCols = 4;

    // First, place main topics
    topics.forEach((topic, idx) => {
        const x = START_X + (currentCol * H_SPACING);
        const y = START_Y + 100 + (currentRow * V_SPACING);
        const id = nextId();

        nodePositions.set(topic.name, { x, y, id });

        // Topic node with gradient
        cells.push(`
            <mxCell id="${id}" value="${escapeXml(topic.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#4299e1;strokeColor=#2b6cb0;fontColor=#ffffff;fontSize=12;fontStyle=1;shadow=1;arcSize=15;" vertex="1" parent="1">
                <mxGeometry x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" as="geometry"/>
            </mxCell>
        `);

        // Add edge from title to first-level topics
        const edgeId = nextId();
        cells.push(`
            <mxCell id="${edgeId}" edge="1" parent="1" source="${titleId}" target="${id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#4299e1;strokeWidth=2;endArrow=classic;">
                <mxGeometry relative="1" as="geometry"/>
            </mxCell>
        `);

        currentCol++;
        if (currentCol >= maxCols) {
            currentCol = 0;
            currentRow++;
        }
    });

    // Place subtopics
    let subtopicRow = currentRow + 1;
    topics.forEach((topic) => {
        if (!topic.subtopics || topic.subtopics.length === 0) return;

        const parentPos = nodePositions.get(topic.name);
        if (!parentPos) return;

        topic.subtopics.forEach((subtopic, subIdx) => {
            const offsetX = (subIdx - Math.floor(topic.subtopics!.length / 2)) * (NODE_WIDTH + 40);
            const x = parentPos.x + offsetX;
            const y = START_Y + 100 + (subtopicRow * V_SPACING);
            const id = nextId();

            nodePositions.set(subtopic.name, { x, y, id });

            // Subtopic node - lighter color
            cells.push(`
                <mxCell id="${id}" value="${escapeXml(subtopic.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#90cdf4;strokeColor=#4299e1;fontColor=#1a365d;fontSize=11;shadow=0;arcSize=10;" vertex="1" parent="1">
                    <mxGeometry x="${x}" y="${y}" width="${NODE_WIDTH - 20}" height="${NODE_HEIGHT - 10}" as="geometry"/>
                </mxCell>
            `);

            // Edge from parent topic to subtopic
            const edgeId = nextId();
            cells.push(`
                <mxCell id="${edgeId}" edge="1" parent="1" source="${parentPos.id}" target="${id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#90cdf4;strokeWidth=1;dashed=1;endArrow=classic;">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            `);
        });
    });

    // Place devices if available
    if (devices && devices.length > 0) {
        const deviceStartY = START_Y + 100 + ((subtopicRow + 1) * V_SPACING);

        // Devices swimlane/container
        const swimlaneId = nextId();
        cells.push(`
            <mxCell id="${swimlaneId}" value="Apparatus &amp; Equipment" style="swimlane;whiteSpace=wrap;html=1;fillColor=#fbd38d;strokeColor=#dd6b20;fontColor=#744210;fontSize=12;fontStyle=1;startSize=30;rounded=1;" vertex="1" parent="1">
                <mxGeometry x="${START_X}" y="${deviceStartY}" width="${devices.length * 120 + 40}" height="100" as="geometry"/>
            </mxCell>
        `);

        devices.slice(0, 8).forEach((device, idx) => {
            const x = 20 + (idx * 120);
            const y = 40;
            const id = nextId();

            cells.push(`
                <mxCell id="${id}" value="${escapeXml(device.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#feebc8;strokeColor=#ed8936;fontColor=#744210;fontSize=10;" vertex="1" parent="${swimlaneId}">
                    <mxGeometry x="${x}" y="${y}" width="100" height="40" as="geometry"/>
                </mxCell>
            `);
        });
    }

    // Add concept edges if provided
    if (conceptEdges && conceptEdges.length > 0) {
        conceptEdges.forEach((edge) => {
            const sourcePos = nodePositions.get(edge.from);
            const targetPos = nodePositions.get(edge.to);

            if (sourcePos && targetPos) {
                const edgeId = nextId();
                const edgeColor = edge.type === 'uses' ? '#ed8936' : edge.type === 'related' ? '#9f7aea' : '#4299e1';
                const dashStyle = edge.type === 'related' ? 'dashed=1;' : '';

                cells.push(`
                    <mxCell id="${edgeId}" edge="1" parent="1" source="${sourcePos.id}" target="${targetPos.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${edgeColor};strokeWidth=1;${dashStyle}endArrow=classic;">
                        <mxGeometry relative="1" as="geometry"/>
                    </mxCell>
                `);
            }
        });
    }

    // Assemble the full mxfile XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" version="24.0.0">
    <diagram name="Concept Map" id="concept-map-1">
        <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800">
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                ${cells.join('\n')}
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
}

// ============================================================================
// Main Component
// ============================================================================

export const ConceptMapDrawIO: React.FC<ConceptMapDrawIOProps> = ({
    title,
    topics,
    conceptEdges,
    devices,
    onTopicClick,
}) => {
    const drawioRef = useRef<DrawIoEmbedRef | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const hasLoadedRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate and load the diagram
    const loadConceptMap = useCallback(() => {
        if (!drawioRef.current || !topics.length) return;

        const xml = generateConceptMapXML(title, topics, devices, conceptEdges);

        try {
            drawioRef.current.load({ xml });
            setIsLoading(false);
        } catch (e) {
            console.error('Failed to load concept map:', e);
            setIsLoading(false);
        }
    }, [title, topics, devices, conceptEdges]);

    // Handle Draw.io ready
    const onDrawioLoad = useCallback(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        // Small delay to ensure Draw.io is fully ready
        setTimeout(() => {
            loadConceptMap();
        }, 200);
    }, [loadConceptMap]);

    // Regenerate diagram when data changes
    useEffect(() => {
        if (hasLoadedRef.current && drawioRef.current) {
            loadConceptMap();
        }
    }, [topics, devices, conceptEdges, loadConceptMap]);

    // Handle export
    const handleExport = useCallback(async () => {
        if (!drawioRef.current) return;

        try {
            drawioRef.current.exportDiagram({ format: 'png' });
        } catch (e) {
            console.error('Failed to export diagram:', e);
        }
    }, []);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    }, [isFullscreen]);

    // Handle fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div
            ref={containerRef}
            className="h-full w-full flex flex-col bg-slate-50 rounded-xl overflow-hidden"
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-semibold text-slate-800 text-sm">Concept Map</span>
                    <span className="text-xs text-slate-500">• {topics.length} topics</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadConceptMap}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Regenerate"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Export as PNG"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Fullscreen"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Draw.io Canvas */}
            <div className="flex-1 relative min-h-0">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <span className="text-sm text-slate-600">Loading concept map...</span>
                        </div>
                    </div>
                )}


                <div className="w-full h-full">
                    <DrawIoEmbed
                        ref={drawioRef}
                        onLoad={onDrawioLoad}
                        urlParameters={{
                            ui: 'min',
                            spin: true,
                            noSaveBtn: true,
                            noExitBtn: true,
                            saveAndExit: false,
                            modified: false,
                        }}
                    />
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 bg-white border-t border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span className="text-xs text-slate-600">Topics</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-300" />
                    <span className="text-xs text-slate-600">Subtopics</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-400" />
                    <span className="text-xs text-slate-600">Equipment</span>
                </div>
                <div className="flex-1" />
                <span className="text-xs text-slate-400">
                    Click nodes to edit • Drag to rearrange
                </span>
            </div>
        </div>
    );
};

export default ConceptMapDrawIO;
