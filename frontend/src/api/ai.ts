import { apiClient } from './client';

export interface AISettings {
  provider: string;
  model: string;
  base_url?: string;
  api_key?: string;
}

export interface AIModelList {
  models: string[];
}

export const aiApi = {
  getSettings: async () => {
    const response = await apiClient.get<AISettings>('/ai/settings');
    return response.data;
  },
  
  updateSettings: async (settings: AISettings) => {
    const response = await apiClient.post<AISettings>('/ai/settings', settings);
    return response.data;
  },
  
  getModels: async (provider: string) => {
    const response = await apiClient.get<AIModelList>(`/ai/models/${provider}`);
    return response.data.models;
  },
  
  testConnection: async (provider: string, base_url?: string, api_key?: string) => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/ai/test', {
      provider,
      base_url,
      api_key,
    });
    return response.data;
  }
};
