import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { PublicQueueResponse } from './public-queue.models';

// Public unauthenticated queue query — runs over the `anon` role (no session required).
// The RPC get_public_service_queue enforces privacy and returns only anonymized projection data.
@Injectable({ providedIn: 'root' })
export class PublicQueueService {
  async getPublicQueue(token: string): Promise<PublicQueueResponse> {
    if (!token) return { is_enabled: false, error: 'Token no especificado' };
    const { data, error } = await supabase.rpc('get_public_service_queue', { p_token: token });
    if (error) throw error;
    return (data as unknown as PublicQueueResponse) ?? { is_enabled: false };
  }
}
