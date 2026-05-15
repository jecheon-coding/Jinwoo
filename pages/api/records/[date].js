import supabase from '../../../lib/supabase';

export default async function handler(req, res) {
  const { date } = req.query;
  if (req.method === 'DELETE') {
    await supabase.from('attendance').delete().eq('record_date', date);
    await supabase.from('records').delete().eq('record_date', date);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
