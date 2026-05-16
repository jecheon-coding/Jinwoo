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
    let chkQ = supabase.from('records').select('record_date, contract_id')
      .eq('record_date', body.record_date);
    if (contractId) chkQ = chkQ.eq('contract_id', contractId);
    else            chkQ = chkQ.is('contract_id', null);
    let { data: existing } = await chkQ.maybeSingle();

    // fallback: legacy records with null contract_id
    if (!existing && contractId) {
      const { data: legacy } = await supabase.from('records')
        .select('record_date, contract_id')
        .eq('record_date', body.record_date).is('contract_id', null).maybeSingle();
      existing = legacy;
    }

    let error;
    if (existing) {
      // update by (record_date, original contract_id) — works with both record_date PK and id PK schemas
      let updQ = supabase.from('records').update(recordData).eq('record_date', body.record_date);
      const origCid = existing.contract_id;
      if (origCid) updQ = updQ.eq('contract_id', origCid);
      else         updQ = updQ.is('contract_id', null);
      ({ error } = await updQ);
    } else {
      ({ error } = await supabase.from('records').insert(recordData));
    }
    if (error) {
      console.error('[records POST] DB error:', JSON.stringify(error));
      return res.status(500).json({ error: error.message, details: error });
    }

    // 출근 저장 — 기존 삭제 후 재삽입 (레거시 null contract_id도 함께 삭제)
    if (body.attendance && Array.isArray(body.attendance)) {
      let delQ = supabase.from('attendance').delete().eq('record_date', body.record_date);
      if (contractId) delQ = delQ.eq('contract_id', contractId);
      else            delQ = delQ.is('contract_id', null);
      await delQ;
      if (contractId) {
        await supabase.from('attendance').delete()
          .eq('record_date', body.record_date).is('contract_id', null);
      }

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
