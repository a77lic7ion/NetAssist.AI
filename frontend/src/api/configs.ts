import { apiClient } from './client';

export interface DeviceConfig {
  id: string;
  device_id: string;
  content: string;
  created_at: string;
}

export const configsApi = {
  upload: async (deviceId: string, content: string) => {
    const response = await apiClient.post<DeviceConfig>(`/configs/${deviceId}`, { content });
    return response.data;
  },
  
  getLatest: async (deviceId: string) => {
    const response = await apiClient.get<DeviceConfig>(`/configs/${deviceId}/latest`);
    return response.data;
  }
};
