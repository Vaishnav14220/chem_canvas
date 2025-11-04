import { Volume2, Play, Brain, FileBarChart, Star, HelpCircle, Edit3 } from 'lucide-react';

interface StudyToolsPanelProps {
  documentName: string;
  onStudyToolClick: (tool: string) => void;
}

export default function StudyToolsPanel({ documentName, onStudyToolClick }: StudyToolsPanelProps) {
  const studyTools = [
    {
      id: 'audio',
      name: 'Audio Overview',
      icon: Volume2,
      description: 'Listen to summary',
      shortcut: '⌘A'
    },
    {
      id: 'video',
      name: 'Video Overview', 
      icon: Play,
      description: 'Watch summary',
      shortcut: '⌘V'
    },
    {
      id: 'mindmap',
      name: 'Mind Map',
      icon: Brain,
      description: 'Visual connections',
      shortcut: '⌘M'
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: FileBarChart,
      description: 'Detailed analysis',
      shortcut: '⌘R'
    },
    {
      id: 'flashcards',
      name: 'Flashcards',
      icon: Star,
      description: 'Study cards',
      shortcut: '⌘F'
    },
    {
      id: 'quiz',
      name: 'Quiz',
      icon: HelpCircle,
      description: 'Test knowledge',
      shortcut: '⌘Q'
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Study Tools Grid */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {studyTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onStudyToolClick(tool.id)}
                className="group relative p-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all duration-200 text-left"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-gray-600 group-hover:bg-blue-900/50 rounded-lg flex items-center justify-center mb-3 transition-colors">
                    <Icon size={20} className="text-gray-300 group-hover:text-blue-400" />
                  </div>
                  <h4 className="text-sm font-medium text-white group-hover:text-blue-300 mb-1">
                    {tool.name}
                  </h4>
                  <p className="text-xs text-gray-400 group-hover:text-blue-200">
                    {tool.description}
                  </p>
                </div>
                
                {/* Shortcut Badge */}
                <div className="absolute top-2 right-2">
                  <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 text-gray-400 rounded border border-gray-600">
                    {tool.shortcut}
                  </kbd>
                </div>

                {/* Edit Icon */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit3 size={14} className="text-gray-500" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Document Info */}
      {documentName && (
        <div className="mt-auto">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 text-sm">📄</span>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-medium text-white truncate">
                  {documentName}
                </h5>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <span>1 source</span>
                  <span>•</span>
                  <span>1m ago</span>
                </div>
              </div>
              <button className="p-1 hover:bg-gray-600 rounded transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Add Note Button */}
          <button className="w-full mt-3 p-3 border border-dashed border-gray-600 hover:border-blue-400 hover:bg-blue-900/20 rounded-lg transition-all text-center group">
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-sm text-gray-400 group-hover:text-blue-300">Add note</span>
            </div>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!documentName && (
        <div className="mt-auto text-center py-8">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h4 className="text-sm font-medium text-white mb-2">Study Tools Ready</h4>
          <p className="text-xs text-gray-400">
            Upload a document to start generating study materials
          </p>
        </div>
      )}
    </div>
  );
}
