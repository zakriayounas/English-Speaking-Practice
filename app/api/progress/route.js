import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
  const [{ data: learners }, { data: attempts }, { data: exercises }] = await Promise.all([
    admin.from('profiles').select('id,full_name').eq('role', 'learner'),
    admin.from('attempts').select('user_id,exercise_id,score,max_score,submitted_at').order('submitted_at', { ascending: false }),
    admin.from('exercises').select('id,title,published,owner_id').order('created_at', { ascending: false }),
  ]);
  const learnerRows = (learners || []).map(learner => {
    const learnerAttempts = (attempts || []).filter(attempt => attempt.user_id === learner.id);
    return { ...learner, attempts: learnerAttempts.length, average: learnerAttempts.length ? Math.round(learnerAttempts.reduce((total, attempt) => total + (attempt.max_score ? attempt.score / attempt.max_score : 0), 0) / learnerAttempts.length * 100) : 0 };
  });
  return Response.json({ learners: learnerRows, attempts: attempts || [], exercises: exercises || [] });
}
