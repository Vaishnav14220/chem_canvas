
import React from 'react';
import { useEditorStore } from './editorStore';
import { Layers, Cuboid } from 'lucide-react';

const PropertyInput = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
    <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-4 font-mono">{label}</span>
        <input
            type="number"
            step={0.1}
            value={value?.toFixed(2)}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full bg-[#111] border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
        />
    </div>
);

export const RightSidebar = () => {
    const { nodes, selection, selectNode, updateNode, removeNode } = useEditorStore();
    const selectedNode = nodes.find(n => n.id === selection[0]);

    return (
        <div className="absolute top-0 right-0 h-full w-64 bg-[#1a1a1a]/95 border-l border-white/10 flex flex-col z-10 backdrop-blur-sm">

            {/* Helper Tabs (Fake for visual matching iCraft) */}
            <div className="flex border-b border-white/10">
                <button className="flex-1 p-3 text-xs font-medium text-cyan-400 border-b-2 border-cyan-500 bg-white/5">
                    Inspector
                </button>
                <button className="flex-1 p-3 text-xs font-medium text-gray-500 hover:text-white">
                    Settings
                </button>
            </div>

            {/* Scene Graph */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 bg-[#222] border-b border-white/10 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hierarchy</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            onClick={() => selectNode(node.id)}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${selection.includes(node.id)
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'text-gray-300 hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            <Cuboid className="w-3.5 h-3.5 opacity-70" />
                            <span className="truncate">{node.label}</span>
                        </div>
                    ))}
                    {nodes.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-600 italic">
                            Scene is empty. Add assets from the library.
                        </div>
                    )}
                </div>
            </div>

            {/* Properties Panel (Bottom Half) */}
            <div className="h-1/2 border-t border-white/10 flex flex-col bg-[#1e1e1e]">
                <div className="p-3 border-b border-white/10">
                    <h3 className="text-xs font-bold text-white">Properties</h3>
                </div>

                {selectedNode ? (
                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">

                        {/* Identity */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-gray-500 font-bold">Name</label>
                            <input
                                type="text"
                                value={selectedNode.label}
                                onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                                className="w-full bg-[#111] border border-white/20 rounded px-2 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            />
                        </div>

                        {/* Transform */}
                        <div className="space-y-3 pt-2">
                            <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Transform</div>

                            {/* Position */}
                            <div className="grid grid-cols-3 gap-2">
                                <PropertyInput
                                    label="X"
                                    value={selectedNode.position[0]}
                                    onChange={(v) => updateNode(selectedNode.id, { position: [v, selectedNode.position[1], selectedNode.position[2]] })}
                                />
                                <PropertyInput
                                    label="Y"
                                    value={selectedNode.position[1]}
                                    onChange={(v) => updateNode(selectedNode.id, { position: [selectedNode.position[0], v, selectedNode.position[2]] })}
                                />
                                <PropertyInput
                                    label="Z"
                                    value={selectedNode.position[2]}
                                    onChange={(v) => updateNode(selectedNode.id, { position: [selectedNode.position[0], selectedNode.position[1], v] })}
                                />
                            </div>
                        </div>

                        {/* Style */}
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Appearance</div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={selectedNode.color}
                                    onChange={(e) => updateNode(selectedNode.id, { color: e.target.value })}
                                    className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                                />
                                <div className="text-xs text-gray-400">Color</div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <button
                                className="w-full py-2 px-3 bg-red-900/30 text-red-400 border border-red-900/50 rounded hover:bg-red-900/50 transition-colors text-xs font-bold uppercase"
                                onClick={() => removeNode(selectedNode.id)}
                            >
                                Delete Object
                            </button>
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-xs text-center p-6">
                        Select an object to view properties
                    </div>
                )}
            </div>
        </div>
    );
};
