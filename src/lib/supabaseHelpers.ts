import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export type GhostInsert = Database['public']['Tables']['ghost_positions']['Insert'];
export type GhostRow = Database['public']['Tables']['ghost_positions']['Row'];

export async function insertGhostPositions(client: SupabaseClient<Database>, rows: GhostInsert[]) {
  const res = await client.from('ghost_positions').insert(rows);
  return res as { data: GhostRow[] | null; error: unknown };
}

export async function fetchGhostPositions(client: SupabaseClient<Database>, pageUrl: string, excludeSessionId?: string | null, limit = 30) {
  let builder = client
    .from('ghost_positions')
  .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
  .eq('page_url', pageUrl);

  if (excludeSessionId) builder = builder.neq('session_id', excludeSessionId);

  const q = await builder.order('created_at', { ascending: false }).limit(limit);
  return q as { data: GhostRow[] | null; error: unknown };
}
