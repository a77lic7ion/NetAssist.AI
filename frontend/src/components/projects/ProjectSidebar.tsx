import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Plus, Trash2, FolderOpen } from 'lucide-react';

export const ProjectSidebar: React.FC = () => {
  const { projects, selectProject, createProject, deleteProject, currentProject } = useProjectStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName);
    setNewProjectName('');
    setIsCreating(false);
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Projects</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="p-1 hover:bg-gray-200 rounded-md"
        >
          <Plus size={18} />
        </button>
      </div>

      {isCreating && (
        <div className="p-4 bg-white border-b border-gray-200">
          <input
            type="text"
            className="w-full border rounded px-2 py-1 text-sm mb-2"
            placeholder="Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsCreating(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {projects.map(project => (
          <div 
            key={project.id}
            className={`p-3 border-b border-gray-100 cursor-pointer flex justify-between items-center group
              ${currentProject?.id === project.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-100'}
            `}
            onClick={() => selectProject(project.id)}
          >
            <div className="flex items-center gap-2 truncate">
              <FolderOpen size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 truncate">{project.name}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete project?')) deleteProject(project.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {projects.length === 0 && !isCreating && (
          <div className="p-8 text-center text-gray-400 text-sm">
            No projects yet.
          </div>
        )}
      </div>
    </div>
  );
};
