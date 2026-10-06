
import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { SearchInterface } from './components/SearchInterface'; // Import SearchInterface
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { Menu, Globe, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false); // New State for Private Mode
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'activity' | 'archives' | 'search'>('settings');
  
  // View Mode: 'chat' or 'search'
  const [viewMode, setViewMode] = useState<'chat' | 'search'>('chat');

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  // Triggered when clicking a chat in sidebar
  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsPrivateMode(false); // Reset private mode when selecting history
    setIsSidebarOpen(false);
    setViewMode('chat'); // Switch back to chat
  }, []);

  // Triggered when clicking "New Chat"
  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setIsPrivateMode(false); // Reset private mode
    setIsSidebarOpen(false);
    setViewMode('chat'); // Switch back to chat
  }, []);

  // Triggered when clicking "New Private Chat"
  const handleNewPrivateChat = useCallback(() => {
    setCurrentSessionId(null);
    setIsPrivateMode(true); // Enable private mode
    setIsSidebarOpen(false);
    setViewMode('chat'); // Switch back to chat
  }, []);

  const openSettings = useCallback((tab: 'settings' | 'activity' | 'archives' | 'search') => {
    setActiveSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);
  
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f8f9fa] text-gray-800 font-sans print:h-auto print:overflow-visible">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden print:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} bg-[#f0f4f9] border-r border-[#dadce0] print:hidden`}>
        <Sidebar 
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onNewPrivateChat={handleNewPrivateChat}
          onOpenSettings={openSettings}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col h-full relative bg-white print:w-full print:h-auto print:static min-w-0">
        {/* Header (Unified for Mobile/Desktop) */}
        <header className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-white border-b border-[#dadce0] print:hidden shrink-0">
           <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden shrink-0"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <span className="font-medium text-base md:text-lg text-gray-700 md:hidden truncate">
                 {viewMode === 'search' ? 'Web Search' : (isPrivateMode ? '私密对话' : 'Gemini')}
              </span>
           </div>
           
           {/* Mode Toggle Button */}
           <div className="flex items-center gap-2 shrink-0">
              <button
                 onClick={() => {
                    // Open Search Settings directly
                    openSettings('search');
                 }}
                 className="hidden md:flex text-xs text-gray-400 hover:text-blue-600 mr-2 whitespace-nowrap"
              >
                 Config Search
              </button>
              
              <button 
                 onClick={() => setViewMode('chat')}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shadow-sm ${
                    viewMode === 'chat' 
                    ? 'bg-[#1a73e8] text-white border-[#1a73e8] hover:bg-blue-600' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                 }`}
                 title="Chat"
              >
                 <MessageSquare className="w-4 h-4" />
                 <span className="hidden sm:inline">Chat</span>
              </button>

              <button 
                 onClick={() => setViewMode('search')}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shadow-sm ${
                    viewMode === 'search' 
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                 }`}
                 title="Web Search"
              >
                 <Globe className="w-4 h-4" />
                 <span className="hidden sm:inline">Web</span>
              </button>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative print:overflow-visible print:h-auto print:block">
          {/* Persist SearchInterface by hiding it instead of unmounting */}
          <div className={`w-full h-full ${viewMode === 'search' ? 'block' : 'hidden'}`}>
             <SearchInterface />
          </div>

          {/* Persist ChatInterface to prevent state loss on tab switch */}
          <div className={`w-full h-full ${viewMode === 'chat' ? 'block' : 'hidden'}`}>
             <ChatInterface 
               sessionId={currentSessionId}
               onSessionCreated={setCurrentSessionId}
               isPrivateMode={isPrivateMode}
             />
          </div>
        </main>
      </div>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        activeTab={activeSettingsTab}
      />
    </div>
  );
};

export default App;
