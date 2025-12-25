import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Settings, Download, MoreHorizontal, Plus, AlertTriangle, Copy, AlignLeft, Printer, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FormulaItem {
    id: string;
    label?: string;
    page: number;
    latex: string;
    variables: { symbol: string; definition: string; unit?: string }[];
    status: 'verified' | 'unknown';
}

interface FormulaExtractionWorkspaceProps {
    onBack: () => void;
    fileName?: string;
}

const MOCK_FORMULAS: FormulaItem[] = [
    {
        id: '1',
        label: 'FIRST LAW',
        page: 4,
        latex: '\\Delta U = Q - W',
        variables: [
            { symbol: '\\Delta U', definition: 'Change in internal energy' },
            { symbol: 'Q', definition: 'Heat added to system' },
            { symbol: 'W', definition: 'Work done by system' }
        ],
        status: 'verified'
    },
    {
        id: '2',
        label: 'ENTROPY',
        page: 5,
        latex: 'S = k_B \\ln \\Omega',
        variables: [
            { symbol: 'S', definition: 'Entropy' },
            { symbol: 'k_B', definition: 'Boltzmann constant' },
            { symbol: '\\Omega', definition: 'Number of microstates' }
        ],
        status: 'verified'
    },
    {
        id: '3',
        label: 'UNKNOWN',
        page: 5,
        latex: 'dS \\ge \\delta Q / T',
        variables: [],
        status: 'unknown'
    }
];

export const FormulaExtractionWorkspace: React.FC<FormulaExtractionWorkspaceProps> = ({ onBack, fileName = 'Lecture_Notes_Ch4.pdf' }) => {
    const [viewMode, setViewMode] = useState<'extraction' | 'preview'>('extraction');
    const [formulas, setFormulas] = useState<FormulaItem[]>(MOCK_FORMULAS);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Extract Formulas</h1>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            Assignment Prep <span className="text-slate-300">/</span> Thermodynamics
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'extraction' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('extraction')}
                        >
                            <AlignLeft className="w-3.5 h-3.5 inline-block mr-1.5" />
                            Extraction View
                        </button>
                        <button
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('preview')}
                        >
                            <Printer className="w-3.5 h-3.5 inline-block mr-1.5" />
                            Preview Sheet
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1" />

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        AI Analysis Complete
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-cyan-200">
                        <Download className="w-4 h-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Main Content Split Pane */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Source Document (Mock View) */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-50">
                    <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Source: {fileName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="hover:bg-slate-100 p-1 rounded">-</button>
                            <span className="font-mono text-slate-700">100%</span>
                            <button className="hover:bg-slate-100 p-1 rounded">+</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-8 relative">
                        {/* Mock Page Content representing the Reference Image */}
                        <div className="bg-white shadow-sm min-h-[800px] w-full max-w-2xl mx-auto p-12 text-slate-800 relative">
                            <h2 className="text-2xl font-bold mb-6">Chapter 4: The Laws of Thermodynamics</h2>
                            <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                The first law of thermodynamics is a version of the law of conservation of
                                energy, adapted for thermodynamic systems. The law of conservation of
                                energy states that the total energy of an isolated system is constant;
                                energy can be transformed from one form to another, but can be neither
                                created nor destroyed.
                            </p>

                            {/* Highlighted Mock Formula */}
                            <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative group">
                                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                <span className="font-mono text-lg">\Delta U = Q - W</span>
                            </div>

                            <p className="mb-6 text-sm leading-relaxed text-slate-600">
                                where <span className="bg-slate-100 px-1 rounded">\Delta U</span> denotes the change in the internal energy of a closed system,
                                <span className="bg-slate-100 px-1 rounded">Q</span> denotes the quantity of energy supplied to the system as heat, and <span className="bg-slate-100 px-1 rounded">W</span>
                                denotes the amount of thermodynamic work done by the system on its
                                surroundings.
                            </p>

                            <h3 className="text-lg font-bold mb-4 mt-8">Entropy</h3>
                            <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                Entropy is a measure of the number of specific ways in which a
                                thermodynamic system may be arranged, commonly understood as a
                                measure of disorder.
                            </p>

                            {/* Highlighted Mock Formula 2 */}
                            <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative">
                                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                <span className="font-mono text-lg">S = k_B \ln \Omega</span>
                            </div>

                            <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                The second law of thermodynamics states that the total entropy of an
                                isolated system can never decrease over time.
                            </p>

                            {/* Highlighted Mock Formula 3 */}
                            <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative">
                                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                <span className="font-mono text-lg">dS \ge \delta Q / T</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Extracted Items */}
                <div className="w-1/2 flex flex-col bg-slate-50 border-l border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                            <h3 className="font-bold text-slate-800">Extracted Items ({formulas.length})</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-md text-xs font-bold transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                                Manual Entry
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 space-y-4">
                        {formulas.map((item) => (
                            <div
                                key={item.id}
                                className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md ${item.status === 'unknown' ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'}`}
                            >
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            {item.label ? (
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${item.status === 'unknown' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {item.label}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500">
                                                    UNKNOWN
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-400 font-medium">pg {item.page}</span>
                                        </div>
                                        {item.status === 'unknown' && (
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        )}
                                    </div>

                                    {/* Latex Rendering Area */}
                                    <div className="bg-slate-50 rounded-lg p-6 mb-4 flex items-center justify-center min-h-[100px]">
                                        <div className="text-xl text-slate-800 font-serif">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {`$$${item.latex}$$`}
                                            </ReactMarkdown>
                                        </div>
                                    </div>

                                    {item.status !== 'unknown' && (
                                        <div className="mb-4">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Variables</h4>
                                            <div className="space-y-2">
                                                {item.variables.map((v, i) => (
                                                    <div key={i} className="flex items-start gap-3 text-sm">
                                                        <span className="font-bold text-cyan-600 min-w-[24px] text-right font-serif">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkMath]}
                                                                rehypePlugins={[rehypeKatex]}
                                                                components={{
                                                                    p: ({ node, ...props }) => <span {...props} />
                                                                }}
                                                            >
                                                                {`$${v.symbol}$`}
                                                            </ReactMarkdown>
                                                        </span>
                                                        <span className="text-slate-600">{v.definition}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-2 bg-slate-50/50 px-2 py-1 rounded">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">LaTeX:</span>
                                            <code className="text-xs text-slate-500 font-mono">{item.latex}</code>
                                        </div>
                                        <button className="text-slate-300 hover:text-slate-500 transition-colors">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>

                                </div>

                                {item.status === 'unknown' && (
                                    <div className="bg-amber-50/50 px-4 py-3 rounded-b-xl border-t border-amber-100 flex items-center justify-between">
                                        <button className="flex-1 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5">
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Refine with AI
                                            <div className="ml-1 px-1 bg-white/20 rounded text-[9px] font-mono">⌘R</div>
                                        </button>
                                        <div className="w-px h-6 bg-amber-200/50 mx-3"></div>
                                        <div className="flex items-center gap-2">
                                            <button className="text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1.5 hover:bg-amber-100/50 rounded transition-colors">
                                                Confirm
                                            </button>
                                            <button className="text-xs font-medium text-slate-400 hover:text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded transition-colors">
                                                Discard
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
