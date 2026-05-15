import supabase from '../../../lib/supabase';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'PUT') {
    const { data, error } = await supabase
      .from('workers').update(req.body).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === 'DELETE') {
    await supabase.from('workers').delete().eq('id', id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
