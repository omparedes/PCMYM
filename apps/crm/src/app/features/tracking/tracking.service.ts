import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { PublicTrackingInfo } from './tracking.models';

// Public, unauthenticated lookup — runs over the `anon` role (no session).
// The RPC itself decides what's safe to return; this service does no
// filtering of its own.
@Injectable({ providedIn: 'root' })
export class TrackingService {
  async getByToken(token: string): Promise<PublicTrackingInfo> {
    const { data, error } = await supabase.rpc('get_public_tracking_info', { p_token: token });
    if (error) throw error;
    if (!data) throw new Error('No encontramos ninguna orden con este enlace de seguimiento.');
    return data as unknown as PublicTrackingInfo;
  }
}
