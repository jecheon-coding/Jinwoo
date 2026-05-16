import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { start, end, contract_id } = req.query;
    let q = supabase.from('records').select('*').order('record_date');
    if (start)       q = q.gte('record_date', start);
    if (end)         q = q.lte('record_date', end);
    if (contract_id) q = q.eq('contract_id', parseInt(contract_id));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const contractId = body.contract_id ? parseInt(body.contract_id) : null;

    const recordData = { ...body };
    delete recordData.attendance;

    // check if record exists for (record_date, contract_id)
    let chkQ = supabase.from('records').select('id').eq('record_date', body.record_date);
    if (contractId) chkQ = chkQ.eq('contract_id', contractId);
    else            chkQ = chkQ.is('contract_id', null);
    const { data: existing } = await chkQ.maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from('records').update(recordData).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('records').insert(recordData));
    }
    if (error) return res.status(500).json({ error: error.message });

    // 출근 저장 — 기존 삭제 후 재삽입
    if (body.attendance && Array.isArray(body.attendance)) {
      let delQ = supabase.from('attendance').delete().eq('record_date', body.record_date);
      if (contractId) delQ = delQ.eq('contract_id', contractId);
      else            delQ = delQ.is('contract_id', null);
      await delQ;

      const rows = body.attendance.map(a => ({
        record_date: body.record_date,
        contract_id: contractId,
        worker_id:   a.worker_id,
        value:       a.value,
      }));
      if (rows.length) await supabase.from('attendance').insert(rows);
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
