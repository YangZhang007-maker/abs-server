import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!url || !key) {
      console.warn('⚠️  Supabase 未配置，文件上传将不可用。请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'abs-documents';
}