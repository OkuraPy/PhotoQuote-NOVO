import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { clientService, projectService, estimateService, invoiceService, companyProfileService, teamService, projectMemberService } from '../services/database';
import { cacheService } from '../services/cache';

// ── Types ──────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  licenseNumber: string;
  logoUri: string;
  logoScale: number;
}

export type ProjectStatus = 'Draft' | 'Approved' | 'In Progress' | 'Completed';
export type EstimateStatus = 'Draft' | 'Sent' | 'Approved' | 'In Progress' | 'Completed';
export type InvoiceStatus = 'Unpaid' | 'Sent' | 'Paid' | 'Overdue';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  address: string;
  city: string;
  zip: string;
  propertyType: string;
  accessLevel: string;
  floorLevel: string;
  hasElevator: boolean;
  parkingType: string;
  serviceType: string;
  serviceDescription: string;
  status: ProjectStatus;
  photos: string[];
  squareFeet: string;
  linearFeet: string;
  createdAt: string;
}

export interface LineItem {
  id: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxable: boolean;
}

export interface Estimate {
  id: string;
  projectId: string;
  version: number;
  lineItems: LineItem[];
  taxRate: number;
  marginRate: number;
  subtotal: number;
  tax: number;
  margin: number;
  total: number;
  notes: string;
  confidence: number;
  status: EstimateStatus;
  createdAt: string;
}

export interface Invoice {
  id: string;
  estimateId: string;
  projectId: string;
  invoiceNumber: string;
  lineItems: LineItem[];
  taxRate: number;
  marginRate: number;
  subtotal: number;
  tax: number;
  margin: number;
  total: number;
  notes: string;
  status: InvoiceStatus;
  createdAt: string;
}

export type TeamRole = 'admin' | 'estimator' | 'viewer';
export type TeamMemberStatus = 'pending' | 'active' | 'removed';

export interface TeamMember {
  id: string;
  ownerId: string;
  memberEmail: string;
  memberUserId: string | null;
  fullName: string;
  role: TeamRole;
  status: TeamMemberStatus;
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  memberId: string;
  accessLevel: 'view' | 'edit' | 'full';
  assignedAt: string;
  memberName: string;
  memberEmail: string;
  memberRole: string;
}

interface AppState {
  clients: Client[];
  projects: Project[];
  estimates: Estimate[];
  loading: boolean;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Client | undefined;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'status' | 'photos'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Project | undefined;
  getClientProjects: (clientId: string) => Project[];
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt'>) => Promise<Estimate>;
  updateEstimate: (id: string, data: Partial<Estimate>) => Promise<void>;
  getProjectEstimates: (projectId: string) => Estimate[];
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  getEstimateInvoice: (estimateId: string) => Invoice | undefined;
  companyProfile: CompanyProfile;
  updateCompanyProfile: (data: Partial<CompanyProfile>) => Promise<void>;
  refreshData: () => Promise<void>;
  // Team
  teamMembers: TeamMember[];
  addTeamMember: (data: { email: string; fullName: string; role: TeamRole }) => Promise<TeamMember>;
  updateTeamMember: (id: string, data: { role?: TeamRole; status?: TeamMemberStatus; fullName?: string }) => Promise<void>;
  removeTeamMember: (id: string) => Promise<void>;
  // Project Members
  getProjectMembers: (projectId: string) => Promise<ProjectMember[]>;
  assignProjectMember: (projectId: string, memberId: string, accessLevel: ProjectMember['accessLevel']) => Promise<ProjectMember>;
  updateProjectMemberAccess: (id: string, accessLevel: ProjectMember['accessLevel']) => Promise<void>;
  removeProjectMember: (id: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

let idCounter = Date.now();
function generateId(): string {
  return (++idCounter).toString(36);
}

// ── Provider ───────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: '', address: '', city: '', state: 'FL', zip: '',
    phone: '', email: '', website: '', licenseNumber: '', logoUri: '', logoScale: 1,
  });

  // Load data from cache and database on mount/user change
  useEffect(() => {
    if (!user) {
      // Clear data when user logs out
      setClients([]);
      setProjects([]);
      setEstimates([]);
      setInvoices([]);
      setTeamMembers([]);
      cacheService.clearAll();
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Load from cache first (fast)
      const [cachedClients, cachedProjects, cachedEstimates, cachedInvoices, cachedProfile] = await Promise.all([
        cacheService.loadClients(),
        cacheService.loadProjects(),
        cacheService.loadEstimates(),
        cacheService.loadInvoices(),
        cacheService.loadCompanyProfile(),
      ]);

      setClients(cachedClients);
      setProjects(cachedProjects);
      setEstimates(cachedEstimates);
      setInvoices(cachedInvoices);
      if (cachedProfile) setCompanyProfile(cachedProfile);

      // 2. Load from database (accurate)
      const [freshClients, freshProjects, freshEstimates, freshInvoices, freshProfile, freshTeam] = await Promise.all([
        clientService.getAll(user.id),
        projectService.getAll(user.id),
        estimateService.getAll(user.id),
        invoiceService.getAll(user.id),
        companyProfileService.get(user.id),
        teamService.getAll(user.id),
      ]);

      setClients(freshClients);
      setProjects(freshProjects);
      setEstimates(freshEstimates);
      setInvoices(freshInvoices);
      setTeamMembers(freshTeam);
      if (freshProfile) setCompanyProfile(freshProfile);

      // 3. Update cache
      await Promise.all([
        cacheService.saveClients(freshClients),
        cacheService.saveProjects(freshProjects),
        cacheService.saveEstimates(freshEstimates),
        cacheService.saveInvoices(freshInvoices),
        freshProfile && cacheService.saveCompanyProfile(freshProfile),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  const addClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
    if (!user) throw new Error('User not authenticated');

    const client = await clientService.create(data, user.id);
    setClients(prev => {
      const updated = [client, ...prev];
      cacheService.saveClients(updated);
      return updated;
    });
    return client;
  }, [user]);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    if (!user) throw new Error('User not authenticated');

    await clientService.update(id, data, user.id);
    setClients(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c);
      cacheService.saveClients(updated);
      return updated;
    });
  }, [user]);

  const deleteClient = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    await clientService.delete(id, user.id);
    setClients(prev => {
      const updated = prev.filter(c => c.id !== id);
      cacheService.saveClients(updated);
      return updated;
    });
  }, [user]);

  const getClient = useCallback((id: string) => {
    return clients.find(c => c.id === id);
  }, [clients]);

  const addProject = useCallback(async (data: Omit<Project, 'id' | 'createdAt' | 'status' | 'photos'>): Promise<Project> => {
    if (!user) throw new Error('User not authenticated');

    const project = await projectService.create({ ...data, status: 'Draft' }, user.id);
    setProjects(prev => {
      const updated = [project, ...prev];
      cacheService.saveProjects(updated);
      return updated;
    });
    return project;
  }, [user]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    if (!user) throw new Error('User not authenticated');

    await projectService.update(id, data, user.id);
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...data } : p);
      cacheService.saveProjects(updated);
      return updated;
    });
  }, [user]);

  const deleteProject = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    await projectService.delete(id, user.id);
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      cacheService.saveProjects(updated);
      return updated;
    });
  }, [user]);

  const getProject = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const getClientProjects = useCallback((clientId: string) => {
    return projects.filter(p => p.clientId === clientId);
  }, [projects]);

  const addEstimate = useCallback(async (data: Omit<Estimate, 'id' | 'createdAt'>): Promise<Estimate> => {
    if (!user) throw new Error('User not authenticated');

    const estimate = await estimateService.create(data, user.id);
    setEstimates(prev => {
      const updated = [estimate, ...prev];
      cacheService.saveEstimates(updated);
      return updated;
    });
    return estimate;
  }, [user]);

  const updateEstimate = useCallback(async (id: string, data: Partial<Estimate>) => {
    if (!user) throw new Error('User not authenticated');

    await estimateService.update(id, data, user.id);
    setEstimates(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      cacheService.saveEstimates(updated);
      return updated;
    });
  }, [user]);

  const getProjectEstimates = useCallback((projectId: string) => {
    return estimates.filter(e => e.projectId === projectId);
  }, [estimates]);

  const addInvoice = useCallback(async (data: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> => {
    if (!user) throw new Error('User not authenticated');

    const invoice = await invoiceService.create(data, user.id);
    setInvoices(prev => {
      const updated = [invoice, ...prev];
      cacheService.saveInvoices(updated);
      return updated;
    });
    return invoice;
  }, [user]);

  const updateInvoice = useCallback(async (id: string, data: Partial<Invoice>) => {
    if (!user) throw new Error('User not authenticated');

    await invoiceService.update(id, data, user.id);
    setInvoices(prev => {
      const updated = prev.map(inv => inv.id === id ? { ...inv, ...data } : inv);
      cacheService.saveInvoices(updated);
      return updated;
    });
  }, [user]);

  const getEstimateInvoice = useCallback((estimateId: string) => {
    return invoices.find(inv => inv.estimateId === estimateId);
  }, [invoices]);

  // ── Team Members ────────────────────────────
  const addTeamMember = useCallback(async (data: { email: string; fullName: string; role: TeamRole }): Promise<TeamMember> => {
    if (!user) throw new Error('User not authenticated');

    const member = await teamService.create(data, user.id);
    setTeamMembers(prev => [member, ...prev]);
    return member;
  }, [user]);

  const updateTeamMember = useCallback(async (id: string, data: { role?: TeamRole; status?: TeamMemberStatus; fullName?: string }) => {
    if (!user) throw new Error('User not authenticated');

    await teamService.update(id, data, user.id);
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  }, [user]);

  const removeTeamMember = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    await teamService.remove(id, user.id);
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  }, [user]);

  // ── Project Members ────────────────────────────
  const getProjectMembers = useCallback(async (projectId: string): Promise<ProjectMember[]> => {
    return projectMemberService.getByProject(projectId);
  }, []);

  const assignProjectMember = useCallback(async (projectId: string, memberId: string, accessLevel: ProjectMember['accessLevel']): Promise<ProjectMember> => {
    if (!user) throw new Error('User not authenticated');
    return projectMemberService.assign(projectId, memberId, accessLevel, user.id);
  }, [user]);

  const updateProjectMemberAccess = useCallback(async (id: string, accessLevel: ProjectMember['accessLevel']) => {
    await projectMemberService.updateAccess(id, accessLevel);
  }, []);

  const removeProjectMember = useCallback(async (id: string) => {
    await projectMemberService.remove(id);
  }, []);

  const updateCompanyProfile = useCallback(async (data: Partial<CompanyProfile>) => {
    if (!user) throw new Error('User not authenticated');

    await companyProfileService.update(user.id, data);
    const updated = { ...companyProfile, ...data };
    setCompanyProfile(updated);
    await cacheService.saveCompanyProfile(updated);
  }, [user, companyProfile]);

  return (
    <AppContext.Provider value={{
      clients,
      projects,
      estimates,
      loading,
      addClient,
      updateClient,
      deleteClient,
      getClient,
      addProject,
      updateProject,
      deleteProject,
      getProject,
      getClientProjects,
      addEstimate,
      updateEstimate,
      getProjectEstimates,
      invoices,
      addInvoice,
      updateInvoice,
      getEstimateInvoice,
      companyProfile,
      updateCompanyProfile,
      refreshData,
      teamMembers,
      addTeamMember,
      updateTeamMember,
      removeTeamMember,
      getProjectMembers,
      assignProjectMember,
      updateProjectMemberAccess,
      removeProjectMember,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
