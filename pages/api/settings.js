import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const obj = {};
    (data || []).forEach(r => { obj[r.key] = r.value; });
    return res.json(obj);
  }
  if (req.method === 'POST') {
    const updates = Object.entries(req.body).map(([key, value]) => ({ key, value }));
    const { error } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}
