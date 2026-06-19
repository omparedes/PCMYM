import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { ServiceOrderPhoto } from './service-orders.models';

const BUCKET = 'service_photos';
// Signed URLs are reissued on every gallery load (see list()), so this only
// needs to outlive a single page view, not the photo's lifetime.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface ServiceOrderPhotoWithUrl extends ServiceOrderPhoto {
  url: string;
}

// The `service_photos` bucket is private (see migration): every render goes
// through a signed URL, never an unauthenticated public URL, so RLS on
// storage.objects is what ultimately gates access, not a guessable path.
@Injectable({ providedIn: 'root' })
export class ServiceOrderPhotosService {
  async list(serviceOrderId: string): Promise<ServiceOrderPhotoWithUrl[]> {
    const { data, error } = await supabase
      .from('service_order_photos')
      .select('*')
      .eq('service_order_id', serviceOrderId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;

    const photos = data as ServiceOrderPhoto[];
    if (photos.length === 0) return [];

    const paths = photos.map((photo) => photo.storage_path);
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (signError) throw signError;

    const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return photos.map((photo) => ({ ...photo, url: urlByPath.get(photo.storage_path) ?? '' }));
  }

  async upload(serviceOrderId: string, file: File): Promise<void> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data: userData } = await supabase.auth.getUser();
    const storagePath = `${businessId}/${serviceOrderId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from('service_order_photos').insert({
      business_id: businessId,
      service_order_id: serviceOrderId,
      storage_path: storagePath,
      uploaded_by: userData.user?.id ?? null,
    });
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw insertError;
    }
  }
}
