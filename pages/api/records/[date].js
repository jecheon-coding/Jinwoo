import supabase from '../../../lib/supabase';
import { getRole } from '../../../lib/auth';

export default async function handler(req, res) {
  const role = getRole(req);
  if (!role) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });

  const { date, contract_id } = req.query;
  if (req.method === 'DELETE') {
    const cid = contract_id ? parseInt(contract_id) : null;

    let attQ = supabase.from('attendance').delete().eq('record_date', date);
    let recQ = supabase.from('records').delete().eq('record_date', date);
    if (cid) {
      attQ = attQ.eq('contract_id', cid);
      recQ = recQ.eq('contract_id', cid);
    } else {
      attQ = attQ.is('contract_id', null);
      recQ = recQ.is('contract_id', null);
    }
    await attQ;
    await recQ;
    return res.json({ ok: true });
  }
  res.status(405).end();
}
