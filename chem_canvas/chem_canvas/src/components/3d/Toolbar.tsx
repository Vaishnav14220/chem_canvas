
import React from 'react';
import {
    Move, RotateCw, Scaling, MousePointer2,
    Minus, ZoomIn, ZoomOut, Save, Image as ImageIcon
} from 'lucide-react';
import { useEditorStore } from './editorStore';
import { Button } from '../ui/button';

export const Toolbar = () => {
    const { transformMode, setTransformMode } = useEditorStore();

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a]/90 backdrop-blur-md rounded-xl border border-white/10 p-1 flex items-center gap-1 shadow-2xl z-10">

            {/* Transform Tools */}
            <div className="flex bg-black/20 rounded-lg p-1 gap-1">
                <Button
                    variant={transformMode === 'translate' ? "secondary" : "ghost"}
                    size="sm"
                    className={`w-9 h-9 p-0 ${transformMode === 'translate' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setTransformMode('translate')}
                    title="Move (G)"
                >
                    <Move className="w-5 h-5" />
                </Button>
                <Button
                    variant={transformMode === 'rotate' ? "secondary" : "ghost"}
                    size="sm"
                    className={`w-9 h-9 p-0 ${transformMode === 'rotate' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setTransformMode('rotate')}
                    title="Rotate (R)"
                >
                    <RotateCw className="w-5 h-5" />
                </Button>
                <Button
                    variant={transformMode === 'scale' ? "secondary" : "ghost"}
                    size="sm"
                    className={`w-9 h-9 p-0 ${transformMode === 'scale' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setTransformMode('scale')}
                    title="Scale (S)"
                >
                    <Scaling className="w-5 h-5" />
                </Button>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* View Tools - Placeholders mostly for now */}
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-gray-400 hover:text-white">
                <ZoomOut className="w-5 h-5" />
            </Button>
            <div className="text-xs font-mono text-gray-500">100%</div>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-gray-400 hover:text-white">
                <ZoomIn className="w-5 h-5" />
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-gray-400 hover:text-white" title="Export Image">
                <ImageIcon className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-gray-400 hover:text-white" title="Save">
                <Save className="w-5 h-5" />
            </Button>

        </div>
    );
};
