import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { clientService, projectService, estimateService, invoiceService, companyProfileService } from '../services/database';
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
      const [freshClients, freshProjects, freshEstimates, freshInvoices, freshProfile] = await Promise.all([
        clientService.getAll(user.id),
        projectService.getAll(user.id),
        estimateService.getAll(user.id),
        invoiceService.getAll(),
        companyProfileService.get(user.id),
      ]);

      setClients(freshClients);
      setProjects(freshProjects);
      setEstimates(freshEstimates);
      setInvoices(freshInvoices);
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
    const invoice = await invoiceService.create(data);
    setInvoices(prev => {
      const updated = [invoice, ...prev];
      cacheService.saveInvoices(updated);
      return updated;
    });
    return invoice;
  }, []);

  const updateInvoice = useCallback(async (id: string, data: Partial<Invoice>) => {
    await invoiceService.update(id, data);
    setInvoices(prev => {
      const updated = prev.map(inv => inv.id === id ? { ...inv, ...data } : inv);
      cacheService.saveInvoices(updated);
      return updated;
    });
  }, []);

  const getEstimateInvoice = useCallback((estimateId: string) => {
    return invoices.find(inv => inv.estimateId === estimateId);
  }, [invoices]);

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
