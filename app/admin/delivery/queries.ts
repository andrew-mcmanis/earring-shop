import { createServerSupabase } from '../../lib/supabase-server';

export interface PickupDetails {
  address: string;
  note: string;
}

export async function getPickupDetails(): Promise<PickupDetails> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    return { address: data?.pickup_address ?? '', note: data?.pickup_note ?? '' };
  } catch {
    return { address: '', note: '' };
  }
}
