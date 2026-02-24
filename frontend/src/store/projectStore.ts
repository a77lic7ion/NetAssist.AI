import { create } from 'zustand';
import { projectsApi, type Project } from '../api/projects';
import { devicesApi, type Device } from '../api/devices';
import { linksApi, type Link } from '../api/links';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  devices: Device[];
  links: Link[];
  selectedDeviceId: string | null;
  isLoading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  selectDevice: (id: string | null) => void;
  createProject: (name: string, description?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Topology Actions
  refreshDevices: () => Promise<void>;
  addDevice: (device: any) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  addLink: (link: any) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  devices: [],
  links: [],
  selectedDeviceId: null,
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectsApi.list();
      set({ projects });
    } catch (err) {
      set({ error: 'Failed to load projects' });
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },

  selectProject: async (id: string) => {
    set({ isLoading: true, error: null, selectedDeviceId: null });
    try {
      const project = await projectsApi.get(id);
      const devices = await devicesApi.list(id);
      const links = await linksApi.list(id);
      set({ currentProject: project, devices, links });
    } catch (err) {
      set({ error: 'Failed to select project' });
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },

  selectDevice: (id: string | null) => {
    set({ selectedDeviceId: id });
  },

  createProject: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newProject = await projectsApi.create({ name, description });
      set(state => ({ projects: [...state.projects, newProject] }));
      // Automatically select the new project
      await get().selectProject(newProject.id);
    } catch (err) {
      set({ error: 'Failed to create project' });
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },
  
  deleteProject: async (id: string) => {
     set({ isLoading: true, error: null });
    try {
      await projectsApi.delete(id);
      set(state => ({ 
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      }));
    } catch (err) {
      set({ error: 'Failed to delete project' });
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },

  addDevice: async (deviceData) => {
    const project = get().currentProject;
    if (!project) return;
    
    try {
      const newDevice = await devicesApi.create(project.id, deviceData);
      set(state => ({ devices: [...state.devices, newDevice] }));
    } catch (err) {
      console.error(err);
    }
  },

  removeDevice: async (id: string) => {
    try {
      await devicesApi.delete(id);
      set(state => ({ devices: state.devices.filter(d => d.id !== id) }));
    } catch (err) {
      console.error(err);
    }
  },
  
  addLink: async (linkData) => {
    const project = get().currentProject;
    if (!project) return;
    
    try {
      const newLink = await linksApi.create(project.id, linkData);
      set(state => ({ links: [...state.links, newLink] }));
    } catch (err) {
      console.error(err);
    }
  },
  
  removeLink: async (id: string) => {
    try {
      await linksApi.delete(id);
      set(state => ({ links: state.links.filter(l => l.id !== id) }));
    } catch (err) {
      console.error(err);
    }
  },

  refreshDevices: async () => {
    const project = get().currentProject;
    if (!project) return;
    try {
      const devices = await devicesApi.list(project.id);
      set({ devices });
    } catch (err) {
      console.error('Failed to refresh devices', err);
    }
  }
}));
