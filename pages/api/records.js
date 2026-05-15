import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { start, end } = req.query;
    let q = supabase.from('records').select('*').order('record_date');
    if (start) q = q.gte('record_date', start);
    if (end)   q = q.lte('record_date', end);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const { data, error } = await supabase
      .from('records')
      .upsert(body, { onConflict: 'record_date' })
      .select();
    if (error) return res.status(500).json({ error: error.message });

    // 출근 저장
    if (body.attendance && Array.isArray(body.attendance)) {
      const rows = body.attendance.map(a => ({
        record_date: body.record_date,
        worker_id:   a.worker_id,
        value:       a.value,
      }));
      if (rows.length) {
        await supabase.from('attendance')
          .upsert(rows, { onConflict: 'record_date,worker_id' });
      }
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
}
