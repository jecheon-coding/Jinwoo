import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('contracts').select('*').order('sort_order').order('id');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }
  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('contracts').insert(req.body).select();
    if (error) {
      console.error('contracts POST error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    return res.json(data[0]);
  }
  res.status(405).end();
}
