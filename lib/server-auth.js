import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function requireUser(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = serviceClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, admin };
}

export async function requireAdmin(request) {
  const result = await requireUser(request);
  if (result.error) return result;
  const { data: profile, error } = await result.admin.from('profiles').select('role').eq('id', result.user.id).maybeSingle();
  if (error) return { error: Response.json({ error: 'Could not verify admin access' }, { status: 500 }) };
  if (profile?.role !== 'admin') return { error: Response.json({ error: 'Admin access required' }, { status: 403 }) };
  return result;
}
