import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client, Project, Estimate, Invoice, CompanyProfile } from '../context/AppContext';

const CACHE_KEYS = {
  CLIENTS: '@photoquote_clients',
  PROJECTS: '@photoquote_projects',
  ESTIMATES: '@photoquote_estimates',
  INVOICES: '@photoquote_invoices',
  COMPANY_PROFILE: '@photoquote_company_profile',
};

// ============================================
// CACHE SERVICE
// ============================================

export const cacheService = {
  // Clients
  async saveClients(clients: Client[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.CLIENTS, JSON.stringify(clients));
    } catch (error) {
      console.error('Error saving clients to cache:', error);
    }
  },

  async loadClients(): Promise<Client[]> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.CLIENTS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error loading clients from cache:', error);
      return [];
    }
  },

  // Projects
  async saveProjects(projects: Project[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (error) {
      console.error('Error saving projects to cache:', error);
    }
  },

  async loadProjects(): Promise<Project[]> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.PROJECTS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error loading projects from cache:', error);
      return [];
    }
  },

  // Estimates
  async saveEstimates(estimates: Estimate[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.ESTIMATES, JSON.stringify(estimates));
    } catch (error) {
      console.error('Error saving estimates to cache:', error);
    }
  },

  async loadEstimates(): Promise<Estimate[]> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.ESTIMATES);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error loading estimates from cache:', error);
      return [];
    }
  },

  // Invoices
  async saveInvoices(invoices: Invoice[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.INVOICES, JSON.stringify(invoices));
    } catch (error) {
      console.error('Error saving invoices to cache:', error);
    }
  },

  async loadInvoices(): Promise<Invoice[]> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.INVOICES);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error loading invoices from cache:', error);
      return [];
    }
  },

  // Company Profile
  async saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.COMPANY_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving company profile to cache:', error);
    }
  },

  async loadCompanyProfile(): Promise<CompanyProfile | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.COMPANY_PROFILE);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error loading company profile from cache:', error);
      return null;
    }
  },

  // Clear all cache
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },
};
