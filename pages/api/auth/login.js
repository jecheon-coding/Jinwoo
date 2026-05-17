import bcrypt from 'bcryptjs';
import supabase from '../../../lib/supabase';
import { signRole } from '../../../lib/auth';

async function checkPassword(input, stored) {
  if (stored.startsWith('$2')) return bcrypt.compare(input, stored);
  return input === stored; // 평문 폴백 (마이그레이션용)
}

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
  if (await checkPassword(password, adminPw))      role = 'admin';
  else if (await checkPassword(password, userPw))  role = 'user';

  if (!role) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

  // 평문으로 저장된 경우 자동으로 해시로 마이그레이션
  const storedPw = role === 'admin' ? adminPw : userPw;
  if (!storedPw.startsWith('$2')) {
    const key    = role === 'admin' ? 'admin_password' : 'user_password';
    const hashed = await bcrypt.hash(password, 10);
    await supabase.from('settings').upsert({ key, value: hashed }, { onConflict: 'key' });
  }

  const token = signRole(role);
  res.setHeader(
    'Set-Cookie',
    `jinwoo_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
  res.json({ role });
}
