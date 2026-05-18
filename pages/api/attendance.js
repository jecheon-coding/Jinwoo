import supabase from '../../lib/supabase';
import { getRole } from '../../lib/auth';

export default async function handler(req, res) {
  const role = getRole(req);
  if (!role) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });

  if (req.method === 'GET') {
    const { start, end } = req.query;
    let q = supabase.from('attendance').select('*');
    if (start) q = q.gte('record_date', start);
    if (end)   q = q.lte('record_date', end);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }
  res.status(405).end();
}
