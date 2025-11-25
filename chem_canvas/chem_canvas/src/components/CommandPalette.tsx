import { useState, useEffect } from 'react';
import { Search, Pencil, Type, Eraser, Trash2, Download, Grid3x3, Settings, FileText, Volume2, Play, Brain, FileBarChart, Star, HelpCircle, PenLine, FileSpreadsheet } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand: (command: string) => void;
}

export default function CommandPalette({ open, onOpenChange, onCommand }: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  const commands = [
    { id: 'draw', name: 'Switch to Draw Tool', icon: Pencil, shortcut: 'D' },
    { id: 'text', name: 'Switch to Text Tool', icon: Type, shortcut: 'T' },
    { id: 'erase', name: 'Switch to Eraser', icon: Eraser, shortcut: 'E' },
    { id: 'document', name: 'Discover Sources', icon: FileText, shortcut: '⌘D' },
    { id: 'audio', name: 'Generate Audio Overview', icon: Volume2, shortcut: '⌘A' },
    { id: 'video', name: 'Generate Video Overview', icon: Play, shortcut: '⌘V' },
    { id: 'mindmap', name: 'Create Mind Map', icon: Brain, shortcut: '⌘M' },
    { id: 'reports', name: 'Generate Reports', icon: FileBarChart, shortcut: '⌘R' },
    { id: 'flashcards', name: 'Create Flashcards', icon: Star, shortcut: '⌘F' },
    { id: 'quiz', name: 'Generate Quiz', icon: HelpCircle, shortcut: '⌘Q' },
    { id: 'ai-word', name: 'AI Word - Smart Document Editor', icon: PenLine, shortcut: '⌘W' },
    { id: 'ai-sheet', name: 'AI Sheet - Smart Spreadsheet', icon: FileSpreadsheet, shortcut: '⌘S' },
    { id: 'clear', name: 'Clear Canvas', icon: Trash2, shortcut: '⌘⇧C' },
    { id: 'export', name: 'Export Canvas', icon: Download, shortcut: '⌘E' },
    { id: 'grid', name: 'Toggle Grid', icon: Grid3x3, shortcut: 'G' },
    { id: 'settings', name: 'Open Settings', icon: Settings, shortcut: '⌘,' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (commandId: string) => {
    onCommand(commandId);
    onOpenChange(false);
    setSearch('');
  };

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-[20%] left-1/2 -translate-x-1/2 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-[600px] max-w-[90vw] z-50 animate-slide-up overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-700">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 text-base bg-transparent outline-none text-white placeholder-gray-400"
              autoFocus
            />
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-700 rounded border border-gray-600">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No commands found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-900/30 rounded-lg transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 group-hover:bg-blue-900/50 rounded-lg flex items-center justify-center">
                          <Icon size={16} className="text-gray-400 group-hover:text-blue-400" />
                        </div>
                        <span className="text-sm text-gray-300 font-medium group-hover:text-blue-300">{cmd.name}</span>
                      </div>
                      <kbd className="px-2 py-1 text-xs font-mono text-gray-400 bg-gray-700 group-hover:bg-blue-900/50 rounded border border-gray-600">
                        {cmd.shortcut}
                      </kbd>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↵</kbd>
                <span>Select</span>
              </div>
            </div>
            <span className="text-xs text-gray-400">Press <kbd className="text-gray-600">⌘K</kbd> to open</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

