import { supabase } from './supabase';
import { Client, Project, Estimate, LineItem, Invoice, CompanyProfile, TeamMember, ProjectMember, ProjectPhase, PhasePhoto, PhaseComment, ShareToken, PhaseStatus, Agreement, AgreementStatus } from '../context/AppContext';

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
    if (project.propertyType !== undefined) updateData.property_type = project.propertyType || null;
    if (project.accessLevel !== undefined) updateData.access_level = project.accessLevel || null;
    if (project.floorLevel !== undefined) updateData.floor_level = project.floorLevel || null;
    if (project.hasElevator !== undefined) updateData.has_elevator = project.hasElevator;
    if (project.parkingType !== undefined) updateData.parking_type = project.parkingType || null;
    if (project.serviceType !== undefined) updateData.service_type = project.serviceType || null;
    if (project.serviceDescription !== undefined) updateData.service_description = project.serviceDescription || null;
    if (project.squareFeet !== undefined) updateData.square_feet = project.squareFeet || null;
    if (project.linearFeet !== undefined) updateData.linear_feet = project.linearFeet || null;

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
          unit: item.unit || '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.total ?? (item.quantity * item.unit_price),
          taxable: item.taxable ?? true,
        }));

        return {
          id: dbEstimate.id,
          projectId: dbEstimate.project_id,
          version: 1,
          lineItems,
          taxRate: dbEstimate.tax_rate || 0,
          marginRate: dbEstimate.margin_rate || 0,
          subtotal: dbEstimate.subtotal || 0,
          tax: dbEstimate.tax_amount || 0,
          margin: dbEstimate.margin_amount || 0,
          total: dbEstimate.total || dbEstimate.grand_total || 0,
          notes: dbEstimate.notes || '',
          confidence: dbEstimate.confidence || 0,
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
        margin_rate: estimate.marginRate || 0,
        confidence: estimate.confidence || 0,
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
        total: item.quantity * item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        unit: item.unit || 'job',
        category: item.category || 'Item',
        item_order: index,
        taxable: item.taxable ?? true,
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

    if (!refreshedData) {
      throw new Error('Failed to fetch created estimate from database');
    }

    return {
      id: refreshedData.id,
      projectId: refreshedData.project_id,
      version: 1,
      lineItems: estimate.lineItems,
      taxRate: refreshedData.tax_rate || 0,
      marginRate: refreshedData.margin_rate || 0,
      subtotal: refreshedData.subtotal || 0,
      tax: refreshedData.tax_amount || 0,
      margin: refreshedData.margin_amount || 0,
      total: refreshedData.total || refreshedData.grand_total || 0,
      notes: refreshedData.notes || '',
      confidence: refreshedData.confidence || 0,
      status: refreshedData.status as any,
      createdAt: refreshedData.created_at,
    };
  },

  async update(id: string, estimate: Partial<Estimate>, userId: string): Promise<void> {
    const updateData: any = {};
    if (estimate.status !== undefined) updateData.status = estimate.status;
    if (estimate.taxRate !== undefined) updateData.tax_rate = estimate.taxRate;
    if (estimate.marginRate !== undefined) updateData.margin_rate = estimate.marginRate;
    if (estimate.confidence !== undefined) updateData.confidence = estimate.confidence;
    if (estimate.notes !== undefined) updateData.notes = estimate.notes || null;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('estimates')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    }

    // Update line items if provided
    if (estimate.lineItems) {
      // Delete existing line items
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('estimate_id', id);

      if (deleteError) throw deleteError;

      // Insert new line items
      if (estimate.lineItems.length > 0) {
        const lineItemsData = estimate.lineItems.map((item, index) => ({
          estimate_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.subtotal || (item.quantity * item.unitPrice),
          subtotal: item.subtotal || (item.quantity * item.unitPrice),
          unit: item.unit || 'job',
          category: item.category || 'Item',
          item_order: index,
          taxable: item.taxable ?? true,
        }));

        const { error: insertError } = await supabase.from('line_items').insert(lineItemsData);
        if (insertError) throw insertError;
      }
    }
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

export const invoiceService = {
  async getAll(userId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const invoices = await Promise.all(
      (data || []).map(async (dbInvoice) => {
        const { data: lineItemsData } = await supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', dbInvoice.id)
          .order('item_order', { ascending: true });

        const lineItems: LineItem[] = (lineItemsData || []).map((item) => ({
          id: item.id,
          category: item.category || '',
          description: item.description,
          unit: item.unit || '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.total ?? (item.quantity * item.unit_price),
          taxable: item.taxable,
        }));

        return {
          id: dbInvoice.id,
          estimateId: dbInvoice.estimate_id,
          projectId: dbInvoice.project_id,
          invoiceNumber: dbInvoice.invoice_number,
          lineItems,
          taxRate: dbInvoice.tax_rate || 0,
          marginRate: dbInvoice.margin_rate || 0,
          subtotal: dbInvoice.subtotal || 0,
          tax: dbInvoice.tax_amount || 0,
          margin: dbInvoice.margin_amount || 0,
          total: dbInvoice.total || 0,
          notes: dbInvoice.notes || '',
          status: dbInvoice.status as any,
          createdAt: dbInvoice.created_at,
        };
      })
    );

    return invoices;
  },

  async create(invoice: Omit<Invoice, 'id' | 'createdAt'>, userId: string): Promise<Invoice> {
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        estimate_id: invoice.estimateId,
        project_id: invoice.projectId,
        invoice_number: invoice.invoiceNumber,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_rate: invoice.taxRate,
        tax_amount: invoice.tax,
        margin_rate: invoice.marginRate,
        margin_amount: invoice.margin,
        total: invoice.total,
        notes: invoice.notes || null,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create line items
    if (invoice.lineItems.length > 0) {
      const lineItemsData = invoice.lineItems.map((item, index) => ({
        invoice_id: invoiceData.id,
        category: item.category || null,
        description: item.description,
        unit: item.unit || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.subtotal,
        item_order: index,
        taxable: item.taxable,
      }));

      const { error: lineItemsError } = await supabase.from('invoice_line_items').insert(lineItemsData);
      if (lineItemsError) throw lineItemsError;
    }

    return {
      id: invoiceData.id,
      estimateId: invoiceData.estimate_id,
      projectId: invoiceData.project_id,
      invoiceNumber: invoiceData.invoice_number,
      lineItems: invoice.lineItems,
      taxRate: invoiceData.tax_rate,
      marginRate: invoiceData.margin_rate,
      subtotal: invoiceData.subtotal,
      tax: invoiceData.tax_amount,
      margin: invoiceData.margin_amount,
      total: invoiceData.total,
      notes: invoiceData.notes || '',
      status: invoiceData.status as any,
      createdAt: invoiceData.created_at,
    };
  },

  async update(id: string, invoice: Partial<Invoice>, userId: string): Promise<void> {
    const updateData: any = {};
    if (invoice.status !== undefined) updateData.status = invoice.status;
    if (invoice.notes !== undefined) updateData.notes = invoice.notes || null;

    const { error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
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

// ============================================
// TEAM SERVICE
// ============================================

export const teamService = {
  async getAll(ownerId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', ownerId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((m) => ({
      id: m.id,
      ownerId: m.owner_id,
      memberEmail: m.member_email,
      memberUserId: m.member_user_id,
      fullName: m.full_name,
      role: m.role as TeamMember['role'],
      status: m.status as TeamMember['status'],
      createdAt: m.created_at,
    }));
  },

  async create(member: { email: string; fullName: string; role: TeamMember['role'] }, ownerId: string): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        owner_id: ownerId,
        member_email: member.email.toLowerCase().trim(),
        full_name: member.fullName,
        role: member.role,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      ownerId: data.owner_id,
      memberEmail: data.member_email,
      memberUserId: data.member_user_id,
      fullName: data.full_name,
      role: data.role,
      status: data.status,
      createdAt: data.created_at,
    };
  },

  async update(id: string, updates: { role?: TeamMember['role']; status?: TeamMember['status']; fullName?: string }, ownerId: string): Promise<void> {
    const updateData: any = {};
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.fullName !== undefined) updateData.full_name = updates.fullName;

    const { error } = await supabase
      .from('team_members')
      .update(updateData)
      .eq('id', id)
      .eq('owner_id', ownerId);

    if (error) throw error;
  },

  async remove(id: string, ownerId: string): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('owner_id', ownerId);

    if (error) throw error;
  },
};

// ============================================
// PROJECT MEMBER SERVICE
// ============================================

export const projectMemberService = {
  async getByProject(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, team_members(id, full_name, member_email, role, status)')
      .eq('project_id', projectId);

    if (error) throw error;
    return (data || []).map((pm) => ({
      id: pm.id,
      projectId: pm.project_id,
      memberId: pm.member_id,
      accessLevel: pm.access_level as ProjectMember['accessLevel'],
      assignedAt: pm.assigned_at,
      memberName: (pm as any).team_members?.full_name || '',
      memberEmail: (pm as any).team_members?.member_email || '',
      memberRole: (pm as any).team_members?.role || '',
    }));
  },

  async assign(projectId: string, memberId: string, accessLevel: ProjectMember['accessLevel'], assignedBy: string): Promise<ProjectMember> {
    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        member_id: memberId,
        access_level: accessLevel,
        assigned_by: assignedBy,
      })
      .select('*, team_members(id, full_name, member_email, role, status)')
      .single();

    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      memberId: data.member_id,
      accessLevel: data.access_level,
      assignedAt: data.assigned_at,
      memberName: (data as any).team_members?.full_name || '',
      memberEmail: (data as any).team_members?.member_email || '',
      memberRole: (data as any).team_members?.role || '',
    };
  },

  async updateAccess(id: string, accessLevel: ProjectMember['accessLevel']): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .update({ access_level: accessLevel })
      .eq('id', id);

    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================
// PROJECT PHASE SERVICE
// ============================================

export const phaseService = {
  async getAll(projectId: string): Promise<ProjectPhase[]> {
    const { data, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('phase_order', { ascending: true });

    if (error) throw error;

    const phases = await Promise.all(
      (data || []).map(async (phase) => {
        const { data: photos } = await supabase
          .from('phase_photos')
          .select('*')
          .eq('phase_id', phase.id)
          .order('display_order', { ascending: true });

        const { data: comments } = await supabase
          .from('phase_comments')
          .select('*')
          .eq('phase_id', phase.id)
          .order('created_at', { ascending: true });

        return {
          id: phase.id,
          projectId: phase.project_id,
          name: phase.name,
          phaseOrder: phase.phase_order,
          status: phase.status as PhaseStatus,
          notes: phase.notes || '',
          expectedCompletionDate: phase.expected_completion_date,
          actualCompletionDate: phase.actual_completion_date,
          isVisibleToClient: phase.is_visible_to_client ?? true,
          photos: (photos || []).map((p: any) => ({
            id: p.id,
            fileUrl: p.file_url,
            caption: p.caption || '',
            createdAt: p.created_at,
          })),
          comments: (comments || []).map((c: any) => ({
            id: c.id,
            authorType: c.author_type as 'contractor' | 'client',
            authorName: c.author_name || '',
            content: c.content,
            createdAt: c.created_at,
          })),
          createdAt: phase.created_at,
        };
      })
    );

    return phases;
  },

  async create(projectId: string, estimateId: string, name: string, phaseOrder: number, userId: string): Promise<ProjectPhase> {
    const { data, error } = await supabase
      .from('project_phases')
      .insert({
        project_id: projectId,
        estimate_id: estimateId,
        user_id: userId,
        name,
        phase_order: phaseOrder,
        status: 'not_started',
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      phaseOrder: data.phase_order,
      status: data.status as PhaseStatus,
      notes: data.notes || '',
      expectedCompletionDate: data.expected_completion_date,
      actualCompletionDate: data.actual_completion_date,
      isVisibleToClient: data.is_visible_to_client ?? true,
      photos: [],
      comments: [],
      createdAt: data.created_at,
    };
  },

  async update(id: string, data: { name?: string; status?: PhaseStatus; notes?: string; isVisibleToClient?: boolean }): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isVisibleToClient !== undefined) updateData.is_visible_to_client = data.isVisibleToClient;
    if (data.status === 'completed') updateData.actual_completion_date = new Date().toISOString();

    const { error } = await supabase
      .from('project_phases')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    // Delete photos and comments first (no cascade FK)
    await supabase.from('phase_photos').delete().eq('phase_id', id);
    await supabase.from('phase_comments').delete().eq('phase_id', id);

    const { error } = await supabase
      .from('project_phases')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async addPhoto(phaseId: string, projectId: string, userId: string, fileUrl: string, caption: string): Promise<PhasePhoto> {
    const { data, error } = await supabase
      .from('phase_photos')
      .insert({
        phase_id: phaseId,
        project_id: projectId,
        user_id: userId,
        file_url: fileUrl,
        caption,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      fileUrl: data.file_url,
      caption: data.caption || '',
      createdAt: data.created_at,
    };
  },

  async addComment(phaseId: string, projectId: string, authorName: string, content: string): Promise<PhaseComment> {
    const { data, error } = await supabase
      .from('phase_comments')
      .insert({
        phase_id: phaseId,
        project_id: projectId,
        author_type: 'contractor',
        author_name: authorName,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      authorType: data.author_type as 'contractor' | 'client',
      authorName: data.author_name || '',
      content: data.content,
      createdAt: data.created_at,
    };
  },
};

// ============================================
// SHARE TOKEN SERVICE
// ============================================

export const shareTokenService = {
  async getByProject(projectId: string): Promise<ShareToken | null> {
    const { data, error } = await supabase
      .from('project_share_tokens')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      projectId: data.project_id,
      token: data.token,
      isActive: data.is_active,
      showValues: data.show_values,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  },

  async create(projectId: string, userId: string): Promise<ShareToken> {
    // Generate a cryptographically random token using crypto.getRandomValues
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(32);
    crypto.getRandomValues(randomValues);
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(randomValues[i] % chars.length);
    }

    const { data, error } = await supabase
      .from('project_share_tokens')
      .insert({
        project_id: projectId,
        user_id: userId,
        token,
        is_active: true,
        show_values: false,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      token: data.token,
      isActive: data.is_active,
      showValues: data.show_values,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('project_share_tokens')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================
// AGREEMENT SERVICE
// ============================================

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

function buildLineItemsTable(lineItems: LineItem[]): string {
  const rows = lineItems.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(item.unitPrice || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(item.subtotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #e5e7eb;">Category</th>
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #e5e7eb;">Description</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6B7280;border-bottom:2px solid #e5e7eb;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#6B7280;border-bottom:2px solid #e5e7eb;">Unit Price</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#6B7280;border-bottom:2px solid #e5e7eb;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export const agreementService = {
  async getByInvoice(invoiceId: string, userId: string): Promise<Agreement | null> {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAgreement(data);
  },

  async create(
    invoice: Invoice,
    project: { name: string; address: string; city: string; zip: string; serviceType: string },
    client: { id: string; name: string; email: string; phone: string; address: string },
    company: CompanyProfile,
    userId: string,
    state: string = 'FL'
  ): Promise<Agreement> {
    // 1. Load template
    const { data: templateData } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('state', state)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (!templateData) throw new Error(`No contract template found for state: ${state}`);

    // 2. Generate secure token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(32);
    crypto.getRandomValues(randomValues);
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(randomValues[i] % chars.length);
    }

    // 3. Build line items table
    const lineItemsTable = buildLineItemsTable(invoice.lineItems);

    // 4. Build terms blocks HTML
    let termsBlocksHtml = '';
    if (templateData.terms_blocks && Array.isArray(templateData.terms_blocks)) {
      termsBlocksHtml = templateData.terms_blocks.map((block: any) =>
        `<h3>${block.title}</h3>${block.content}`
      ).join('');
    }

    // 5. Fill template variables
    const totalAmount = (invoice.total || 0).toFixed(2);
    const depositAmount = ((invoice.total || 0) / 2).toFixed(2);
    const balanceAmount = depositAmount;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const contractHtml = fillTemplate(templateData.content, {
      client_name: client.name,
      client_address: client.address || 'N/A',
      client_phone: client.phone || 'N/A',
      client_email: client.email || 'N/A',
      company_name: company.name || 'N/A',
      company_address: `${company.address || ''}, ${company.city || ''}, ${company.state || 'FL'} ${company.zip || ''}`,
      company_phone: company.phone || 'N/A',
      company_email: company.email || 'N/A',
      license_number: company.licenseNumber || 'N/A',
      project_name: project.name,
      service_address: `${project.address}, ${project.city}, FL ${project.zip}`,
      service_type: project.serviceType || 'Construction',
      invoice_number: invoice.invoiceNumber,
      total_amount: totalAmount,
      subtotal: (invoice.subtotal || 0).toFixed(2),
      tax_rate: String(invoice.taxRate || 0),
      tax_amount: (invoice.tax || 0).toFixed(2),
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      date: today,
      line_items_table: lineItemsTable,
      terms_blocks: termsBlocksHtml,
    });

    // 6. Insert agreement
    const { data, error } = await supabase
      .from('agreements')
      .insert({
        invoice_id: invoice.id,
        project_id: invoice.projectId,
        client_id: client.id,
        user_id: userId,
        state,
        template_id: templateData.id,
        contract_html: contractHtml,
        token,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return mapAgreement(data);
  },

  async updateStatus(id: string, status: AgreementStatus, userId: string): Promise<void> {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'sent') updateData.sent_at = new Date().toISOString();

    const { error } = await supabase
      .from('agreements')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },
};

function mapAgreement(data: any): Agreement {
  return {
    id: data.id,
    invoiceId: data.invoice_id,
    projectId: data.project_id,
    clientId: data.client_id,
    state: data.state,
    contractHtml: data.contract_html,
    token: data.token,
    status: data.status as AgreementStatus,
    signatureImageUrl: data.signature_image_url,
    signedName: data.signed_name,
    signedDate: data.signed_date,
    pdfUrl: data.pdf_url,
    createdAt: data.created_at,
  };
}
