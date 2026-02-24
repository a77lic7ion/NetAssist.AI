import { apiClient } from './client';

export interface Interface {
  id: string;
  name: string;
  description?: string;
  mode: string;
  vlan_access?: number;
  vlan_trunk_allowed?: any;
  ip_address?: string;
  ip_mask?: string;
  state: string;
}

export interface DeviceVlan {
  vlan_id: number;
  name?: string;
}

export interface Device {
  id: string;
  project_id: string;
  hostname: string;
  role: string;
  vendor: string;
  platform: string;
  management_ip?: string;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
  updated_at: string;
  interfaces: Interface[];
  vlans: DeviceVlan[];
}

export interface DeviceCreate {
  hostname: string;
  role: string;
  vendor?: string;
  platform?: string;
  management_ip?: string;
  canvas_x: number;
  canvas_y: number;
}

export const devicesApi = {
  list: async (projectId: string) => {
    const response = await apiClient.get<Device[]>(`/devices/${projectId}`);
    return response.data;
  },
  
  create: async (projectId: string, device: DeviceCreate) => {
    const response = await apiClient.post<Device>('/devices/', device, {
      params: { project_id: projectId }
    });
    return response.data;
  },
  
  get: async (id: string) => {
    const response = await apiClient.get<Device>(`/devices/detail/${id}`);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await apiClient.delete(`/devices/${id}`);
    return response.data;
  }
};
