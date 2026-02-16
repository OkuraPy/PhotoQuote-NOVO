import React, { createContext, useContext, useState, useCallback } from 'react';

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
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'status' | 'photos'>) => Project;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  getClientProjects: (clientId: string) => Project[];
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt'>) => Estimate;
  updateEstimate: (id: string, data: Partial<Estimate>) => void;
  getProjectEstimates: (projectId: string) => Estimate[];
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  getEstimateInvoice: (estimateId: string) => Invoice | undefined;
  companyProfile: CompanyProfile;
  updateCompanyProfile: (data: Partial<CompanyProfile>) => void;
}

const AppContext = createContext<AppState | null>(null);

let idCounter = Date.now();
function generateId(): string {
  return (++idCounter).toString(36);
}

// ── Provider ───────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: '', address: '', city: '', state: 'FL', zip: '',
    phone: '', email: '', website: '', licenseNumber: '', logoUri: '', logoScale: 1,
  });

  const addClient = useCallback((data: Omit<Client, 'id' | 'createdAt'>): Client => {
    const client: Client = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setClients(prev => [client, ...prev]);
    return client;
  }, []);

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  const getClient = useCallback((id: string) => {
    return clients.find(c => c.id === id);
  }, [clients]);

  const addProject = useCallback((data: Omit<Project, 'id' | 'createdAt' | 'status' | 'photos'>): Project => {
    const project: Project = {
      ...data,
      id: generateId(),
      status: 'Draft',
      photos: [],
      createdAt: new Date().toISOString(),
    };
    setProjects(prev => [project, ...prev]);
    return project;
  }, []);

  const updateProject = useCallback((id: string, data: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const getProject = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const getClientProjects = useCallback((clientId: string) => {
    return projects.filter(p => p.clientId === clientId);
  }, [projects]);

  const addEstimate = useCallback((data: Omit<Estimate, 'id' | 'createdAt'>): Estimate => {
    const estimate: Estimate = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setEstimates(prev => [estimate, ...prev]);
    return estimate;
  }, []);

  const updateEstimate = useCallback((id: string, data: Partial<Estimate>) => {
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  }, []);

  const getProjectEstimates = useCallback((projectId: string) => {
    return estimates.filter(e => e.projectId === projectId);
  }, [estimates]);

  const addInvoice = useCallback((data: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const invoice: Invoice = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [invoice, ...prev]);
    return invoice;
  }, []);

  const updateInvoice = useCallback((id: string, data: Partial<Invoice>) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...data } : inv));
  }, []);

  const getEstimateInvoice = useCallback((estimateId: string) => {
    return invoices.find(inv => inv.estimateId === estimateId);
  }, [invoices]);

  const updateCompanyProfile = useCallback((data: Partial<CompanyProfile>) => {
    setCompanyProfile(prev => ({ ...prev, ...data }));
  }, []);

  return (
    <AppContext.Provider value={{
      clients,
      projects,
      estimates,
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
