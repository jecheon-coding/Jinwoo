import supabase from '../../../lib/supabase';
import { signRole } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '비밀번호를 입력하세요.' });

  const { data } = await supabase
    .from('settings').select('*')
    .in('key', ['admin_password', 'user_password']);
  const s = {};
  (data || []).forEach(r => { s[r.key] = r.value; });

  const adminPw = s.admin_password || process.env.ADMIN_PASSWORD || 'admin';
  const userPw  = s.user_password  || process.env.USER_PASSWORD  || 'user';

  let role = null;
  if (password === adminPw) role = 'admin';
  else if (password === userPw) role = 'user';

  if (!role) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

  const token = signRole(role);
  res.setHeader(
    'Set-Cookie',
    `jinwoo_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
  res.json({ role });
}
