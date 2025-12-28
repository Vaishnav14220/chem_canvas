import React from 'react';
import { useSourceStore } from '../../store/sourceStore';
import { FileText, ChevronDown, Check, FileUp } from 'lucide-react';

interface SourceSelectorProps {
    className?: string;
    onUploadRequest?: () => void;
    variant?: 'default' | 'black';
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({ className = '', onUploadRequest, variant = 'default' }) => {
    const { sources, activeSourceId, setActiveSource } = useSourceStore();
    const [isOpen, setIsOpen] = React.useState(false);

    const activeSource = sources.find(s => s.id === activeSourceId);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const isBlack = variant === 'black';

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${isBlack
                    ? 'border-transparent bg-[#111111] text-slate-100 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.9)] hover:bg-[#1b1b1b]'
                    : 'border-input bg-background text-foreground hover:bg-accent/40'
                    }`}
            >
                <div className="flex items-center gap-2 truncate">
                    <FileText className={`h-3.5 w-3.5 shrink-0 ${isBlack ? 'text-slate-400' : 'text-muted-foreground'}`} />
                    <span className="truncate max-w-[150px]">
                        {activeSource ? activeSource.name : 'Select source'}
                    </span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 ${isBlack ? 'text-slate-400' : 'text-muted-foreground'}`} />
            </button>

            {isOpen && (
                <div className={`absolute top-full left-0 z-50 mt-2 w-full min-w-[200px] overflow-hidden rounded-lg border shadow-md ${isBlack
                    ? 'border-transparent bg-[#111111] text-slate-100 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.9)]'
                    : 'border-border bg-popover text-popover-foreground'
                    }`}>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {sources.length > 0 ? (
                            sources.map(source => (
                                <button
                                    key={source.id}
                                    onClick={() => {
                                        setActiveSource(source.id);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${activeSourceId === source.id
                                        ? isBlack
                                            ? 'bg-[#1b1b1b] text-slate-100'
                                            : 'bg-accent text-accent-foreground'
                                        : isBlack
                                            ? 'text-slate-100 hover:bg-[#1b1b1b]'
                                            : 'text-foreground hover:bg-accent/60'
                                        }`}
                                >
                                    <FileText className={`h-3.5 w-3.5 ${activeSourceId === source.id
                                        ? isBlack
                                            ? 'text-slate-200'
                                            : 'text-primary'
                                        : isBlack
                                            ? 'text-slate-400'
                                            : 'text-muted-foreground'
                                        }`} />
                                    <span className="truncate flex-1">{source.name}</span>
                                    {activeSourceId === source.id && (
                                        <Check className={`h-3 w-3 ${isBlack ? 'text-slate-200' : 'text-primary'}`} />
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className={`px-3 py-3 text-xs text-center italic ${isBlack ? 'text-slate-500' : 'text-muted-foreground'}`}>
                                No sources available
                            </div>
                        )}
                    </div>

                    {onUploadRequest && (
                        <div className={`border-t p-1 ${isBlack ? 'border-transparent bg-[#111111]' : 'border-border bg-muted/40'}`}>
                            <button
                                onClick={() => {
                                    onUploadRequest();
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors ${isBlack
                                    ? 'text-slate-200 hover:bg-[#1b1b1b]'
                                    : 'text-primary hover:bg-accent/60'
                                    }`}
                            >
                                <FileUp className="h-3.5 w-3.5" />
                                Upload New Source
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
