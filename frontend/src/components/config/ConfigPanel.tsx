import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { configsApi } from '../../api/configs';
import { X, Save, FileText, Upload, Trash2 } from 'lucide-react';

export const ConfigPanel: React.FC = () => {
  const { devices, selectedDeviceId, selectDevice, removeDevice } = useProjectStore();
  const [config, setConfig] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedDeviceId) return;
      
      setIsLoading(true);
      setConfig('');
      setStatus(null);
      
      try {
        const latest = await configsApi.getLatest(selectedDeviceId);
        setConfig(latest.content);
      } catch (err) {
        // No config found is fine, just leave empty
        console.log('No existing config found');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeviceId]);

  if (!selectedDevice) return null;

  const handleSave = async () => {
    if (!selectedDeviceId) return;
    
    setIsLoading(true);
    setStatus('Saving...');
    try {
      await configsApi.upload(selectedDeviceId, config);
      setStatus('Saved!');
      setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      console.error(err);
      setStatus('Error saving');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDeviceId) return;
    if (confirm(`Are you sure you want to delete ${selectedDevice.hostname}?`)) {
        await removeDevice(selectedDeviceId);
        selectDevice(null);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setConfig(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl absolute right-0 top-0 bottom-0 z-20">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-800">{selectedDevice.hostname}</h2>
        </div>
        <button 
          onClick={() => selectDevice(null)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500"
        >
          <X size={18} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-2 border-b border-gray-200 flex gap-2 bg-white justify-between">
        <div className="flex gap-2">
            <button 
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium disabled:opacity-50"
            >
            <Save size={14} /> {isLoading ? 'Saving...' : 'Save'}
            </button>
            <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 text-sm font-medium cursor-pointer">
              <Upload size={14} /> Upload
              <input 
                type="file" 
                className="hidden" 
                accept=".txt,.cfg,.conf,.ios" 
                onChange={handleFileUpload}
              />
            </label>
            <span className="text-xs text-green-600 flex items-center">{status}</span>
        </div>
        
        <button 
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm font-medium"
            title="Delete Device"
        >
            <Trash2 size={14} />
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <textarea
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm resize-none focus:outline-none"
          placeholder="Paste running-configuration here..."
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
        <span>{config.length} chars</span>
        <span>{selectedDevice.platform}</span>
      </div>
    </div>
  );
};
