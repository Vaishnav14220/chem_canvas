
import React from 'react';
import {
    Box, Circle, Cylinder, Cone, Square, Type,
    Server, Database, Shield, Radio, Cloud, Globe,
    Smartphone, Folder, FileText
} from 'lucide-react';
import { useEditorStore, NodeType } from './editorStore';

const AssetButton = ({ type, icon: Icon, label }: { type: NodeType, icon: any, label: string }) => {
    const addNode = useEditorStore(state => state.addNode);
    return (
        <button
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#252525] hover:bg-[#333] transition-colors group aspect-square border border-transparent hover:border-cyan-500/30"
            onClick={() => addNode(type)}
        >
            <Icon className="w-6 h-6 text-gray-400 group-hover:text-cyan-400 mb-2 transition-colors" />
            <span className="text-[10px] text-gray-500 group-hover:text-gray-200">{label}</span>
        </button>
    );
};

export const AssetLibrary = () => {
    return (
        <div className="absolute top-0 left-0 h-full w-64 bg-[#1a1a1a]/95 border-r border-white/10 flex flex-col z-10 backdrop-blur-sm">
            <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold text-white/90">Assets</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {/* Primitives */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Primitives</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <AssetButton type="cube" icon={Box} label="Cube" />
                        <AssetButton type="sphere" icon={Circle} label="Sphere" />
                        <AssetButton type="cylinder" icon={Cylinder} label="Cylinder" />
                        <AssetButton type="cone" icon={Cone} label="Cone" />
                        <AssetButton type="plane" icon={Square} label="Plane" />
                        <AssetButton type="text" icon={Type} label="Text" />
                    </div>
                </div>

                {/* Infrastructure */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Infrastructure</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <AssetButton type="server" icon={Server} label="Server" />
                        <AssetButton type="database" icon={Database} label="DB" />
                        <AssetButton type="firewall" icon={Shield} label="Firewall" />
                        <AssetButton type="router" icon={Radio} label="Router" />
                        <AssetButton type="cloud" icon={Cloud} label="Cloud" />
                        <AssetButton type="browser" icon={Globe} label="Browser" />
                    </div>
                </div>

                {/* Business - placeholders mapped to generic cube for now or custom later */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">General</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <AssetButton type="cube" icon={Smartphone} label="Mobile" />
                        <AssetButton type="cube" icon={Folder} label="Folder" />
                        <AssetButton type="cube" icon={FileText} label="Doc" />
                    </div>
                </div>

            </div>
        </div>
    );
};
