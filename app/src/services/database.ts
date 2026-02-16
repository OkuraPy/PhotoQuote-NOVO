import { supabase } from './supabase';
import { Client, Project, Estimate, LineItem, Invoice, CompanyProfile } from '../context/AppContext';

// ============================================
// TYPE MAPPINGS
// ============================================

// Database types (snake_case) to App types (camelCase)
interface DBClient {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface DBProject {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  property_type: string | null;
  access_level: string | null;
  floor_level: string | null;
  has_elevator: boolean;
  parking_type: string | null;
  service_type: string | null;
  service_description: string | null;
  square_feet: string | null;
  linear_feet: string | null;
  status: string;
  created_at: string;
}

interface DBEstimate {
  id: string;
  user_id: string;
  project_id: string;
  estimate_number: string;
  title: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
}

interface DBLineItem {
  id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_order: number;
  category: string | null;
  created_at: string;
}

interface DBUser {
  id: string;
  email: string;
  company_name: string;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  company_license: string | null;
  default_city: string | null;
  default_state: string | null;
  default_zip: string | null;
  logo_url: string | null;
}

// ============================================
// MAPPING FUNCTIONS
// ============================================

const mapClientFromDB = (db: DBClient): Client => ({
  id: db.id,
  name: db.full_name,
  phone: db.phone || '',
  email: db.email || '',
  address: db.address || '',
  notes: db.notes || '',
  createdAt: db.created_at,
});

const mapClientToDB = (client: Omit<Client, 'id' | 'createdAt'>, userId: string) => ({
  user_id: userId,
  full_name: client.name,
  phone: client.phone || null,
  email: client.email || null,
  address: client.address || null,
  notes: client.notes || null,
});

const mapProjectFromDB = (db: DBProject, photos: string[] = []): Project => ({
  id: db.id,
  name: db.name,
  clientId: db.client_id,
  address: db.address || '',
  city: db.city || '',
  zip: db.zip || '',
  propertyType: db.property_type || '',
  accessLevel: db.access_level || '',
  floorLevel: db.floor_level || '',
  hasElevator: db.has_elevator,
  parkingType: db.parking_type || '',
  serviceType: db.service_type || '',
  serviceDescription: db.service_description || '',
  squareFeet: db.square_feet || '',
  linearFeet: db.linear_feet || '',
  status: db.status as any,
  photos,
  createdAt: db.created_at,
});

const mapProjectToDB = (project: Omit<Project, 'id' | 'createdAt' | 'photos'>, userId: string) => ({
  user_id: userId,
  client_id: project.clientId,
  name: project.name,
  address: project.address || null,
  city: project.city || null,
  zip: project.zip || null,
  property_type: project.propertyType || null,
  access_level: project.accessLevel || null,
  floor_level: project.floorLevel || null,
  has_elevator: project.hasElevator,
  parking_type: project.parkingType || null,
  service_type: project.serviceType || null,
  service_description: project.serviceDescription || null,
  square_feet: project.squareFeet || null,
  linear_feet: project.linearFeet || null,
  status: project.status,
});

const mapCompanyProfileFromDB = (db: DBUser): CompanyProfile => ({
  name: db.company_name,
  address: db.company_address || '',
  city: db.default_city || '',
  state: db.default_state || '',
  zip: db.default_zip || '',
  phone: db.company_phone || '',
  email: db.company_email || '',
  website: db.company_website || '',
  licenseNumber: db.company_license || '',
  logoUri: db.logo_url || '',
  logoScale: 1,
});

// ============================================
// CLIENT SERVICE
// ============================================

export const clientService = {
  async getAll(userId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapClientFromDB);
  },

  async create(client: Omit<Client, 'id' | 'createdAt'>, userId: string): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert(mapClientToDB(client, userId))
      .select()
      .single();

    if (error) throw error;
    return mapClientFromDB(data);
  },

  async update(id: string, client: Partial<Omit<Client, 'id' | 'createdAt'>>, userId: string): Promise<void> {
    const updateData: any = {};
    if (client.name !== undefined) updateData.full_name = client.name;
    if (client.phone !== undefined) updateData.phone = client.phone || null;
    if (client.email !== undefined) updateData.email = client.email || null;
    if (client.address !== undefined) updateData.address = client.address || null;
    if (client.notes !== undefined) updateData.notes = client.notes || null;

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },
};

// ============================================
// PROJECT SERVICE
// ============================================

export const projectService = {
  async getAll(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Load photos for each project
    const projects = await Promise.all(
      (data || []).map(async (dbProject) => {
        const { data: mediaData } = await supabase
          .from('media')
          .select('file_url')
          .eq('project_id', dbProject.id)
          .eq('media_type', 'photo')
          .order('display_order', { ascending: true });

        const photos = (mediaData || []).map((m) => m.file_url);
        return mapProjectFromDB(dbProject, photos);
      })
    );

    return projects;
  },

  async getById(id: string, userId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return null;

    // Load photos
    const { data: mediaData } = await supabase
      .from('media')
      .select('file_url')
      .eq('project_id', id)
      .eq('media_type', 'photo')
      .order('display_order', { ascending: true });

    const photos = (mediaData || []).map((m) => m.file_url);
    return mapProjectFromDB(data, photos);
  },

  async create(project: Omit<Project, 'id' | 'createdAt' | 'photos'>, userId: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert(mapProjectToDB(project, userId))
      .select()
      .single();

    if (error) throw error;
    return mapProjectFromDB(data, []);
  },

  async update(
    id: string,
    project: Partial<Omit<Project, 'id' | 'createdAt' | 'photos'>>,
    userId: string
  ): Promise<void> {
    const updateData: any = {};
    if (project.name !== undefined) updateData.name = project.name;
    if (project.clientId !== undefined) updateData.client_id = project.clientId;
    if (project.address !== undefined) updateData.address = project.address || null;
    if (project.city !== undefined) updateData.city = project.city || null;
    if (project.zip !== undefined) updateData.zip = project.zip || null;
    if (project.status !== undefined) updateData.status = project.status;
    // Add other fields as needed

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async addPhoto(projectId: string, photoUrl: string, displayOrder: number): Promise<void> {
    const { error } = await supabase.from('media').insert({
      project_id: projectId,
      media_type: 'photo',
      file_url: photoUrl,
      display_order: displayOrder,
    });

    if (error) throw error;
  },
};

// ============================================
// ESTIMATE SERVICE
// ============================================

export const estimateService = {
  async getAll(userId: string): Promise<Estimate[]> {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Load line items for each estimate
    const estimates = await Promise.all(
      (data || []).map(async (dbEstimate) => {
        const { data: lineItemsData } = await supabase
          .from('line_items')
          .select('*')
          .eq('estimate_id', dbEstimate.id)
          .order('item_order', { ascending: true });

        const lineItems: LineItem[] = (lineItemsData || []).map((item) => ({
          id: item.id,
          category: item.category || '',
          description: item.description,
          unit: '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.total,
          taxable: true,
        }));

        return {
          id: dbEstimate.id,
          projectId: dbEstimate.project_id,
          version: 1,
          lineItems,
          taxRate: dbEstimate.tax_rate,
          marginRate: 0,
          subtotal: dbEstimate.subtotal,
          tax: dbEstimate.tax_amount,
          margin: 0,
          total: dbEstimate.total,
          notes: dbEstimate.notes || '',
          confidence: 0,
          status: dbEstimate.status as any,
          createdAt: dbEstimate.created_at,
        };
      })
    );

    return estimates;
  },

  async create(estimate: Omit<Estimate, 'id' | 'createdAt'>, userId: string): Promise<Estimate> {
    // Create estimate
    const { data: estimateData, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        user_id: userId,
        project_id: estimate.projectId,
        title: 'Estimate',
        status: estimate.status,
        tax_rate: estimate.taxRate,
        notes: estimate.notes || null,
      })
      .select()
      .single();

    if (estimateError) throw estimateError;

    // Create line items
    if (estimate.lineItems.length > 0) {
      const lineItemsData = estimate.lineItems.map((item, index) => ({
        estimate_id: estimateData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        category: item.category || null,
        item_order: index,
      }));

      const { error: lineItemsError } = await supabase.from('line_items').insert(lineItemsData);
      if (lineItemsError) throw lineItemsError;
    }

    // Fetch the created estimate with updated totals (triggers have calculated them)
    const { data: refreshedData } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateData.id)
      .single();

    return {
      id: refreshedData!.id,
      projectId: refreshedData!.project_id,
      version: 1,
      lineItems: estimate.lineItems,
      taxRate: refreshedData!.tax_rate,
      marginRate: 0,
      subtotal: refreshedData!.subtotal,
      tax: refreshedData!.tax_amount,
      margin: 0,
      total: refreshedData!.total,
      notes: refreshedData!.notes || '',
      confidence: 0,
      status: refreshedData!.status as any,
      createdAt: refreshedData!.created_at,
    };
  },

  async update(id: string, estimate: Partial<Estimate>, userId: string): Promise<void> {
    const updateData: any = {};
    if (estimate.status !== undefined) updateData.status = estimate.status;
    if (estimate.taxRate !== undefined) updateData.tax_rate = estimate.taxRate;
    if (estimate.notes !== undefined) updateData.notes = estimate.notes || null;

    const { error } = await supabase
      .from('estimates')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },
};

// ============================================
// INVOICE SERVICE
// ============================================

// Note: Invoices are not in the DB schema yet, keeping them in memory for now
export const invoiceService = {
  invoices: [] as Invoice[],

  async getAll(): Promise<Invoice[]> {
    return this.invoices;
  },

  async create(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
    const newInvoice: Invoice = {
      ...invoice,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.invoices.push(newInvoice);
    return newInvoice;
  },

  async update(id: string, invoice: Partial<Invoice>): Promise<void> {
    const index = this.invoices.findIndex((inv) => inv.id === id);
    if (index !== -1) {
      this.invoices[index] = { ...this.invoices[index], ...invoice };
    }
  },

  async delete(id: string): Promise<void> {
    this.invoices = this.invoices.filter((inv) => inv.id !== id);
  },
};

// ============================================
// COMPANY PROFILE SERVICE
// ============================================

export const companyProfileService = {
  async get(userId: string): Promise<CompanyProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return mapCompanyProfileFromDB(data);
  },

  async update(userId: string, profile: Partial<CompanyProfile>): Promise<void> {
    const updateData: any = {};
    if (profile.name !== undefined) updateData.company_name = profile.name;
    if (profile.address !== undefined) updateData.company_address = profile.address || null;
    if (profile.city !== undefined) updateData.default_city = profile.city || null;
    if (profile.state !== undefined) updateData.default_state = profile.state || null;
    if (profile.zip !== undefined) updateData.default_zip = profile.zip || null;
    if (profile.phone !== undefined) updateData.company_phone = profile.phone || null;
    if (profile.email !== undefined) updateData.company_email = profile.email || null;
    if (profile.website !== undefined) updateData.company_website = profile.website || null;
    if (profile.licenseNumber !== undefined) updateData.company_license = profile.licenseNumber || null;
    if (profile.logoUri !== undefined) updateData.logo_url = profile.logoUri || null;

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
  },
};
