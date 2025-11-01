export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Supabaseのスキーマをこれに合わせる
export type Database = {
  public: {
    Tables: {
      ghost_positions: {
        Row: {
          id: number; 
          session_id: string | null;
          page_url: string | null;
          scroll_top: number | null;
          scroll_left: number | null;
          viewport_height: number | null;
          viewport_width: number | null;
          stayed: boolean | null;
          created_at: string | null; // ISO timestamp
        };
        Insert: {
          id?: number;
          session_id?: string | null;
          page_url?: string | null;
          scroll_top?: number | null;
          scroll_left?: number | null;
          viewport_height?: number | null;
          viewport_width?: number | null;
          stayed?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          session_id?: string | null;
          page_url?: string | null;
          scroll_top?: number | null;
          scroll_left?: number | null;
          viewport_height?: number | null;
          viewport_width?: number | null;
          stayed?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
  };
};
