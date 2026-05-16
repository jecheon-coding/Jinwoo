import supabase from '../../../lib/supabase';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'PUT') {
    const { data, error } = await supabase
      .from('contracts').update(req.body).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}
