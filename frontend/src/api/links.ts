import { apiClient } from './client';

export interface Link {
  id: string;
  project_id: string;
  source_device_id: string;
  source_interface: string;
  target_device_id: string;
  target_interface: string;
  medium: string;
  vlan_allow_list?: number[]; // We might need to handle parsing if backend returns string
  state: string;
}

export interface LinkCreate {
  source_device_id: string;
  source_interface: string;
  target_device_id: string;
  target_interface: string;
  medium?: string;
  vlan_allow_list?: number[];
}

export const linksApi = {
  list: async (projectId: string) => {
    const response = await apiClient.get<Link[]>(`/links/${projectId}`);
    // Handle potential JSON parsing if backend sends string for vlan_allow_list
    // (Though usually axios/backend serialization handles this)
    return response.data.map(link => ({
      ...link,
      vlan_allow_list: typeof link.vlan_allow_list === 'string' 
        ? JSON.parse(link.vlan_allow_list) 
        : link.vlan_allow_list
    }));
  },
  
  create: async (projectId: string, link: LinkCreate) => {
    const response = await apiClient.post<Link>('/links/', link, {
      params: { project_id: projectId }
    });
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await apiClient.delete(`/links/${id}`);
    return response.data;
  }
};
