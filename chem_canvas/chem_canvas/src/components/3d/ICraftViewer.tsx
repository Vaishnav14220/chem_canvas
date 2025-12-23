import React, { useState, useRef } from 'react';
import { ICraftPlayer, ICraftPlayerInstance, CameraBar, ZoomBar, PlayerBar } from '@icraft/player-react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface Template {
    name: string;
    file: string;
    thumbnail?: string;
}

const TEMPLATES: Template[] = [
    { name: 'Network Architecture', file: '/icraft-templates/NetworkArchitectureSpecial.iplayer' },
    { name: 'Cache Cluster', file: '/icraft-templates/CacheCluster.iplayer' },
];

export const ICraftViewer = () => {
    const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
    const [showGallery, setShowGallery] = useState(false);
    const instanceRef = useRef<ICraftPlayerInstance | null>(null);

    const containerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#111',
    };

    const cameraBarStyle: React.CSSProperties = {
        left: '50%',
        transform: 'translateX(-50%)',
        top: '10px',
        bottom: 'initial',
    };

    const zoomBarStyle: React.CSSProperties = {
        right: '10px',
        top: '10px',
        bottom: 'initial',
    };

    const playerBarStyle: React.CSSProperties = {
        left: '10px',
        transform: 'translateX(0)',
        width: 'calc(100% - 20px)',
    };

    return (
        <div style={containerStyle}>
            {/* Template Gallery Toggle */}
            <button
                onClick={() => setShowGallery(!showGallery)}
                className="absolute top-4 left-4 z-50 bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm border border-white/10"
            >
                <Layers className="w-4 h-4" />
                Templates
                {showGallery ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Template Gallery Sidebar */}
            {showGallery && (
                <div className="absolute top-16 left-4 z-50 bg-black/90 backdrop-blur-md rounded-lg border border-white/10 p-3 w-56 max-h-[60vh] overflow-y-auto">
                    <h3 className="text-white text-sm font-bold mb-3">iCraft Templates</h3>
                    <div className="space-y-2">
                        {TEMPLATES.map((template) => (
                            <button
                                key={template.file}
                                onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowGallery(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedTemplate.file === template.file
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                        : 'text-gray-300 hover:bg-white/10 border border-transparent'
                                    }`}
                            >
                                {template.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* iCraft Player */}
            <ICraftPlayer
                key={selectedTemplate.file}
                src={selectedTemplate.file}
                ref={instanceRef}
                addons={
                    <>
                        <CameraBar style={cameraBarStyle} />
                        <ZoomBar style={zoomBarStyle} />
                        <PlayerBar style={playerBarStyle} />
                    </>
                }
            />

            {/* Current Template Label */}
            <div className="absolute bottom-16 left-4 bg-black/70 text-white/80 px-3 py-1 rounded text-xs">
                Viewing: {selectedTemplate.name}
            </div>
        </div>
    );
};

export default ICraftViewer;
