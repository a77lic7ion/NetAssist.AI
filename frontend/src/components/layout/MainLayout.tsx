import React, { useEffect } from 'react';
import { SettingsModal } from '../modals/SettingsModal';
import { ProjectSidebar } from '../projects/ProjectSidebar';
import { TopologyCanvas } from '../canvas/TopologyCanvas';
import { useUIStore } from '../../store/ui';
import { useProjectStore } from '../../store/projectStore';
import { Settings } from 'lucide-react';
import { ConfigPanel } from '../config/ConfigPanel';

export const MainLayout: React.FC = () => {
  const { openSettings } = useUIStore();
  const { loadProjects } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex justify-between items-center px-4 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
             <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="font-bold text-gray-800 text-lg">NetVal</h1>
        </div>
        
        <button
          onClick={openSettings}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <ProjectSidebar />
        <main className="flex-1 relative">
           <TopologyCanvas />
           <ConfigPanel />
        </main>
      </div>

      <SettingsModal />
    </div>
  );
};
