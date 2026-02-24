import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { aiApi, type AISettings } from '../../api/ai';

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama (Local)' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'mistral', name: 'Mistral AI' },
  { id: 'anthropic', name: 'Anthropic Claude' },
];

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useUIStore();
  const [settings, setSettings] = useState<AISettings>({
    provider: 'ollama',
    model: '',
    base_url: '',
    api_key: ''
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      loadSettings();
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    if (settings.provider) {
      loadModels(settings.provider);
    }
  }, [settings.provider]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await aiApi.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (provider: string) => {
    try {
      const models = await aiApi.getModels(provider);
      setAvailableModels(models);
      if (models.length > 0 && !models.includes(settings.model)) {
        setSettings(prev => ({ ...prev, model: models[0] }));
      }
    } catch (err) {
      console.error('Failed to load models', err);
      setAvailableModels([]);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await aiApi.updateSettings(settings);
      closeSettings();
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await aiApi.testConnection(
        settings.provider,
        settings.base_url,
        settings.api_key
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">AI Settings</h2>
        
        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              AI Provider
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model
            </label>
            {availableModels.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                placeholder="Enter model name"
              />
            )}
          </div>

          {/* Base URL (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Base URL (Optional)
            </label>
            <input
              type="text"
              value={settings.base_url || ''}
              onChange={(e) => setSettings({ ...settings, base_url: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              placeholder={settings.provider === 'ollama' ? 'http://localhost:11434' : 'https://api...'}
            />
          </div>

          {/* API Key (Optional) */}
          {settings.provider !== 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                placeholder="sk-..."
              />
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-md text-sm ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            onClick={handleTest}
            disabled={testing || loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          
          <div className="space-x-3">
            <button
              onClick={closeSettings}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
