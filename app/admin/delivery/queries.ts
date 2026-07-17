import { createServerSupabase } from '../../lib/supabase-server';

export interface DeliverySettings {
  /** Flat delivery base price (£): first item full, each extra 50%. */
  base: number;
  address: string;
  note: string;
  /** True when the read failed — the editor must not offer a save that could
   *  overwrite the real stored values with these blanks. */
  error: boolean;
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('delivery_base, pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    if (error) return { base: 0, address: '', note: '', error: true };
    return {
      base: Number(data?.delivery_base ?? 0),
      address: data?.pickup_address ?? '',
      note: data?.pickup_note ?? '',
      error: false,
    };
  } catch {
    return { base: 0, address: '', note: '', error: true };
  }
}
