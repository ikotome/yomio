import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export type GhostInsert = Database['public']['Tables']['ghost_positions']['Insert'];
export type GhostRow = Database['public']['Tables']['ghost_positions']['Row'];

// Minimal Postgrest-like builder shape for our ghost_positions table. This avoids
// using `any` while still matching the methods we call in the app.
type GhostPostgrestBuilder = {
  insert: (rows: GhostInsert[] | GhostInsert) => Promise<{ data: GhostRow[] | null; error: unknown }>;
  select: (s: string) => GhostPostgrestBuilder;
  eq: (col: string, v: unknown) => GhostPostgrestBuilder;
  neq: (col: string, v: unknown) => GhostPostgrestBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => GhostPostgrestBuilder;
  limit: (n: number) => Promise<{ data: GhostRow[] | null; error: unknown }>;
};

// These helpers wrap supabase-js calls and centralize a single, narrow cast so
// callers can use typed inputs/outputs without repeating casts.

export async function insertGhostPositions(client: SupabaseClient<Database>, rows: GhostInsert[]) {
  const res = await (client as unknown as { from: (t: 'ghost_positions') => GhostPostgrestBuilder }).from('ghost_positions').insert(rows);
  return res as { data: GhostRow[] | null; error: unknown };
}

export async function fetchGhostPositions(client: SupabaseClient<Database>, pageUrl: string, excludeSessionId?: string | null, limit = 30) {
  const builder = (client as unknown as { from: (t: 'ghost_positions') => GhostPostgrestBuilder }).from('ghost_positions')
    .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
    .eq('page_url', pageUrl);

  if (excludeSessionId) builder.neq('session_id', excludeSessionId);

  const q = await builder.order('created_at', { ascending: false }).limit(limit);
  return q as { data: GhostRow[] | null; error: unknown };
}
