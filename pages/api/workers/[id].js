import supabase from '../../../lib/supabase';
import { getRole } from '../../../lib/auth';

export default async function handler(req, res) {
  const role = getRole(req);
  if (!role) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });

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
