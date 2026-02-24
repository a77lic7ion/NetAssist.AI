import { apiClient } from './client';

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export const projectsApi = {
  list: async () => {
    const response = await apiClient.get<Project[]>('/projects/');
    return response.data;
  },
  
  create: async (project: ProjectCreate) => {
    const response = await apiClient.post<Project>('/projects/', project);
    return response.data;
  },
  
  get: async (id: string) => {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  }
};
