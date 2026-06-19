import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { Customer, CustomerUpdate, NewCustomer } from './customers.models';

export interface CustomersQuery {
  search: string;
  includeArchived: boolean;
}

// business_id is enforced by RLS on read/update; on insert the client must
// supply it explicitly (no default/trigger sets it), resolved via the
// auth_business_id() RPC granted to `authenticated` in the base migration.
@Injectable({ providedIn: 'root' })
export class CustomersService {
  async list(query: CustomersQuery): Promise<Customer[]> {
    let request = supabase.from('customers').select('*').order('name', { ascending: true });

    if (!query.includeArchived) {
      request = request.is('archived_at', null);
    }

    const term = query.search.trim();
    if (term) {
      // PostgREST `or` syntax uses commas/parens as separators; strip them from user input.
      const safeTerm = term.replace(/[,()]/g, '');
      request = request.or(
        `name.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%,document_number.ilike.%${safeTerm}%`,
      );
    }

    const { data, error } = await request;
    if (error) throw error;
    return data;
  }

  async get(id: string): Promise<Customer> {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(input: NewCustomer): Promise<Customer> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data, error } = await supabase
      .from('customers')
      .insert({ ...input, business_id: businessId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, input: CustomerUpdate): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  // Soft delete only: there is no DELETE policy on `customers` (see migration).
  // Archiving just sets archived_at; it is reversible via unarchive().
  async archive(id: string): Promise<Customer> {
    return this.setArchivedAt(id, new Date().toISOString());
  }

  async unarchive(id: string): Promise<Customer> {
    return this.setArchivedAt(id, null);
  }

  private async setArchivedAt(id: string, archivedAt: string | null): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update({ archived_at: archivedAt })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
}
