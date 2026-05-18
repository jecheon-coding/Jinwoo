import bcrypt from 'bcryptjs';
import supabase from '../../lib/supabase';
import { getRole } from '../../lib/auth';

const PASSWORD_KEYS = ['admin_password', 'user_password'];

export default async function handler(req, res) {
  const role = getRole(req);
  if (!role) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const obj = {};
    (data || []).forEach(r => {
      if (!PASSWORD_KEYS.includes(r.key)) obj[r.key] = r.value;
    });
    return res.json(obj);
  }
  if (req.method === 'POST') {
    const updates = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (PASSWORD_KEYS.includes(key)) {
        if (!value) continue; // 비워두면 변경 안 함
        updates.push({ key, value: await bcrypt.hash(value, 10) });
      } else {
        updates.push({ key, value });
      }
    }
    const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}
