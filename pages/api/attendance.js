import supabase from '../../lib/supabase';

export default async function handler(req, res) {
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
