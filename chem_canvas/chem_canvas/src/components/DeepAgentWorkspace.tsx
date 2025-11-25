/**
 * Deep Agent Workspace Component
 * 
 * A full-page workspace for interacting with the Deep Agent system.
 * Provides a comprehensive environment with:
 * - Chat interface
 * - Tool visualization
 * - Planning display
 * - Subagent management
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  ArrowLeft, 
  Info, 
  Settings, 
  Moon, 
  Sun,
  Maximize2,
  Minimize2,
  HelpCircle,
  Sparkles,
  ListTodo,
  Users,
  Wrench,
  FileText
} from 'lucide-react';
import DeepAgentChat from './DeepAgentChat';
import { 
  getAvailableTools, 
  getAvailableSubagents 
} from '../services/deepAgentService';

interface DeepAgentWorkspaceProps {
  onBack?: () => void;
  initialMessage?: string;
}

const DeepAgentWorkspace: React.FC<DeepAgentWorkspaceProps> = ({ 
  onBack, 
  initialMessage 
}) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tools' | 'subagents' | 'docs'>('chat');

  // Get capabilities
  const tools = getAvailableTools();
  const subagents = getAvailableSubagents();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Deep Agent</h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Advanced Chemistry Assistant
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tab Navigation */}
          <nav className="flex items-center space-x-1 mr-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'bg-purple-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-4 h-4 inline-block mr-1" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'bg-purple-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Wrench className="w-4 h-4 inline-block mr-1" />
              Tools
            </button>
            <button
              onClick={() => setActiveTab('subagents')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'subagents'
                  ? 'bg-purple-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4 inline-block mr-1" />
              Subagents
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'docs'
                  ? 'bg-purple-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4 inline-block mr-1" />
              Docs
            </button>
          </nav>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <DeepAgentChat 
            isOpen={true} 
            initialMessage={initialMessage}
            className="h-full"
          />
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className={`h-full overflow-y-auto p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Available Tools</h2>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Deep Agent has access to specialized chemistry tools that enable it to perform 
                complex tasks like molecule lookups, reaction analysis, and more.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map((tool: { name: string; description: string }) => (
                  <div
                    key={tool.name}
                    className={`p-4 rounded-xl border ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                      }`}>
                        <Wrench className={`w-5 h-5 ${
                          isDarkMode ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                      </div>
                      <h3 className="font-semibold">{tool.name.replace(/_/g, ' ')}</h3>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className={`mt-8 p-4 rounded-xl ${
                isDarkMode ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <Info className={`w-5 h-5 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <div>
                    <h4 className="font-medium mb-1">How Tools Work</h4>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Deep Agent automatically selects and uses the appropriate tools based on your request.
                      You don't need to explicitly call tools - just describe what you need, and the agent
                      will determine which tools to use.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subagents Tab */}
        {activeTab === 'subagents' && (
          <div className={`h-full overflow-y-auto p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Specialized Subagents</h2>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Deep Agent can delegate complex subtasks to specialized subagents. Each subagent 
                has its own expertise and tools, allowing for focused and efficient task handling.
              </p>
              
              <div className="space-y-4">
                {subagents.map((subagent: { name: string; description: string }) => (
                  <div
                    key={subagent.name}
                    className={`p-6 rounded-xl border ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`p-3 rounded-xl ${
                        isDarkMode ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20' : 'bg-gradient-to-r from-purple-100 to-blue-100'
                      }`}>
                        <Users className={`w-6 h-6 ${
                          isDarkMode ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{subagent.name}</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Specialized Subagent
                        </p>
                      </div>
                    </div>
                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {subagent.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className={`mt-8 p-4 rounded-xl ${
                isDarkMode ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <ListTodo className={`w-5 h-5 mt-0.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                  <div>
                    <h4 className="font-medium mb-1">Context Isolation</h4>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Subagents run in isolated contexts, which helps keep the main agent's context clean
                      while still enabling deep exploration of specific topics. The results are summarized
                      and returned to the main agent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Docs Tab */}
        {activeTab === 'docs' && (
          <div className={`h-full overflow-y-auto p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="max-w-4xl mx-auto prose prose-lg prose-invert">
              <h2 className="text-2xl font-bold mb-6">Deep Agent Documentation</h2>
              
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">What is Deep Agent?</h3>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Deep Agent is an advanced AI assistant built on the <code>deepagents</code> library.
                  It goes beyond simple question-answering by implementing:
                </p>
                <ul className={`list-disc pl-6 space-y-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li><strong>Planning & Task Decomposition:</strong> Breaks complex tasks into manageable steps</li>
                  <li><strong>Context Management:</strong> Uses a virtual file system to manage large amounts of information</li>
                  <li><strong>Subagent Spawning:</strong> Delegates specialized tasks to focused subagents</li>
                  <li><strong>Tool Integration:</strong> Uses specialized chemistry tools for accurate information</li>
                </ul>
              </section>

              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">Core Capabilities</h3>
                
                <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h4 className="font-medium flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-green-400" />
                    Planning (write_todos)
                  </h4>
                  <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Before tackling complex tasks, Deep Agent creates a to-do list to track progress
                    and adapt its approach as new information emerges.
                  </p>
                </div>

                <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    File System (ls, read_file, write_file, edit_file)
                  </h4>
                  <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Deep Agent can save and retrieve information using a virtual file system,
                    preventing context overflow and enabling work with large datasets.
                  </p>
                </div>

                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Subagents (task)
                  </h4>
                  <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Specialized subagents can be spawned for focused tasks like research,
                    tutoring, or problem-solving, keeping the main context clean.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">Example Prompts</h3>
                <div className={`space-y-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <p className="font-medium">"Research the mechanism of the Diels-Alder reaction and create practice problems"</p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Uses: planning, research subagent, practice problem tool
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <p className="font-medium">"Explain electronegativity to a beginner and help them understand periodic trends"</p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Uses: tutor subagent, concept explanation tool
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <p className="font-medium">"Calculate the molar mass and percent composition of glucose, then analyze its biological significance"</p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Uses: molecular calculator tool, problem solver subagent
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-3">Tips for Best Results</h3>
                <ul className={`list-disc pl-6 space-y-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li>Be specific about what you want to learn or accomplish</li>
                  <li>For complex tasks, let the agent plan its approach</li>
                  <li>Ask follow-up questions to dig deeper into topics</li>
                  <li>Request practice problems to reinforce learning</li>
                  <li>Specify your level (beginner, intermediate, advanced) for better explanations</li>
                </ul>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-lg w-full rounded-xl p-6 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Quick Help</h3>
              <button
                onClick={() => setShowHelp(false)}
                className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                ✕
              </button>
            </div>
            <div className={`space-y-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>
                <strong>Deep Agent</strong> is your advanced chemistry study assistant with
                planning capabilities and specialized tools.
              </p>
              <p>
                <strong>Ask anything:</strong> From simple definitions to complex reaction mechanisms
              </p>
              <p>
                <strong>Get help:</strong> Request explanations, practice problems, or molecule information
              </p>
              <p>
                <strong>Watch it plan:</strong> For complex tasks, the agent will show its planning process
              </p>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeepAgentWorkspace;
