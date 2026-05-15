import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabase';

export async function getServerSideProps({ params }) {
  const dateParam = params?.date?.[0];
  const today = new Date().toISOString().slice(0, 10);
  const recordDate = dateParam || today;

  const [recRes, wRes, attRes, setRes] = await Promise.all([
    supabase.from('records').select('*').eq('record_date', recordDate).maybeSingle(),
    supabase.from('workers').select('*').eq('active', true).order('sort_order').order('id'),
    supabase.from('attendance').select('*').eq('record_date', recordDate),
    supabase.from('settings').select('*'),
  ]);

  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });
  const attMap = {};
  (attRes.data || []).forEach(a => { attMap[a.worker_id] = a.value; });

  return {
    props: {
      recordDate,
      record: recRes.data || null,
      workers: wRes.data || [],
      attMap,
      settings,
    },
  };
}

export default function DailyPage({ recordDate, record, workers, attMap, settings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    record_date:    recordDate,
    vehicle_number: record?.vehicle_number ?? settings.vehicle_number ?? '',
    driver:         record?.driver         ?? settings.driver ?? '',
    route:          record?.route          ?? '',
    op_start:       record?.op_start       ?? '',
    op_end:         record?.op_end         ?? '',
    trips:          record?.trips          ?? 1,
    weight_1:       record?.weight_1       ?? '',
    weight_2:       record?.weight_2       ?? '',
    weight_3:       record?.weight_3       ?? '',
    chip_3l:        record?.chip_3l        ?? 0,
    chip_5l:        record?.chip_5l        ?? 0,
    chip_20l:       record?.chip_20l       ?? 0,
    chip_120l:      record?.chip_120l      ?? 0,
    notes:          record?.notes          ?? '',
  });
  const [att, setAtt] = useState(() => {
    const init = {};
    workers.forEach(w => { init[w.id] = attMap[w.id] ?? 1.0; });
    return init;
  });

  const totalW = (parseFloat(form.weight_1) || 0) + (parseFloat(form.weight_2) || 0) + (parseFloat(form.weight_3) || 0);
  const sub3   = (parseInt(form.chip_3l)   || 0) * 3;
  const sub5   = (parseInt(form.chip_5l)   || 0) * 5;
  const sub20  = (parseInt(form.chip_20l)  || 0) * 20;
  const sub120 = (parseInt(form.chip_120l) || 0) * 120;
  const chipTotal = sub3 + sub5 + sub20 + sub120;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDateChange = (newDate) => {
    router.push(`/daily/${newDate}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const attendance = workers.map(w => ({ worker_id: w.id, value: att[w.id] ?? 0 }));
    const body = { ...form, attendance };
    // convert numbers
    ['weight_1','weight_2','weight_3'].forEach(k => { body[k] = parseFloat(body[k]) || 0; });
    ['chip_3l','chip_5l','chip_20l','chip_120l','trips'].forEach(k => { body[k] = parseInt(body[k]) || 0; });

    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const d = form.record_date;
      router.push(`/history/${d.slice(0,4)}/${parseInt(d.slice(5,7))}`);
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm('이 날의 기록을 삭제하시겠습니까?')) return;
    await fetch(`/api/records/${form.record_date}`, { method: 'DELETE' });
    const d = form.record_date;
    router.push(`/history/${d.slice(0,4)}/${parseInt(d.slice(5,7))}`);
  };

  return (
    <>
      <div className="page-header">
        <h1>일일 운행 입력</h1>
        {record && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>삭제</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* 기본 정보 */}
        <div className="card">
          <h2>기본 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>날짜 *</label>
              <input type="date" value={form.record_date} required
                onChange={e => { set('record_date', e.target.value); handleDateChange(e.target.value); }} />
            </div>
            <div className="form-group">
              <label>차량번호</label>
              <input type="text" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)} placeholder="89오4821" />
            </div>
            <div className="form-group">
              <label>운전자</label>
              <input type="text" value={form.driver} onChange={e => set('driver', e.target.value)} placeholder="이름" />
            </div>
            <div className="form-group">
              <label>행선지 / 구역</label>
              <input type="text" value={form.route} onChange={e => set('route', e.target.value)} placeholder="예) 영월읍 2구역" />
            </div>
            <div className="form-group">
              <label>운행시작</label>
              <input type="time" value={form.op_start} onChange={e => set('op_start', e.target.value)} />
            </div>
            <div className="form-group">
              <label>운행종료</label>
              <input type="time" value={form.op_end} onChange={e => set('op_end', e.target.value)} />
            </div>
            <div className="form-group">
              <label>운행횟수</label>
              <input type="number" min="1" value={form.trips} onChange={e => set('trips', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 계근 (톤) */}
        <div className="card">
          <h2>실중량 계근 (톤)</h2>
          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label>1차 (톤)</label>
              <input type="number" step="0.001" value={form.weight_1} onChange={e => set('weight_1', e.target.value)} placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>2차 (톤)</label>
              <input type="number" step="0.001" value={form.weight_2} onChange={e => set('weight_2', e.target.value)} placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>3차 (톤)</label>
              <input type="number" step="0.001" value={form.weight_3} onChange={e => set('weight_3', e.target.value)} placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>합계 (톤)</label>
              <input type="text" readOnly value={totalW.toFixed(3)} />
            </div>
          </div>
        </div>

        {/* 칩 수거 */}
        <div className="card">
          <h2>칩 수거 현황</h2>
          <div className="form-grid form-grid-4">
            {[['chip_3l','3L',sub3],['chip_5l','5L',sub5],['chip_20l','20L',sub20],['chip_120l','120L',sub120]].map(([k,lbl,sub]) => (
              <div className="form-group" key={k}>
                <label>{lbl} 개수</label>
                <input type="number" min="0" value={form[k]} onChange={e => set(k, e.target.value)} />
                <span style={{fontSize:'12px',color:'#6b7280'}}>소계: {sub.toLocaleString()} ℓ</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:'10px',fontWeight:'700',color:'#1e40af'}}>
            합계: {chipTotal.toLocaleString()} ℓ
          </div>
        </div>

        {/* 작업자 출근 */}
        {workers.length > 0 && (
          <div className="card">
            <h2>작업자 출근 현황</h2>
            <div className="att-grid">
              {workers.map(w => (
                <div className="att-row" key={w.id}>
                  <span className="att-name">{w.name}</span>
                  <span className="att-pos">{w.position}</span>
                  <div className="att-options">
                    {[['1.0','전일','full'],['0.5','반일','half'],['0.0','미출','zero']].map(([val,lbl,cls]) => (
                      <label key={val} className={`att-option ${cls}`} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:'2px'}}>
                        <input type="radio" name={`att_${w.id}`}
                          checked={String(att[w.id]) === val}
                          onChange={() => setAtt(a => ({...a, [w.id]: parseFloat(val)}))} />
                        <span style={{padding:'6px 12px',border:'2px solid',borderColor:att[w.id]==parseFloat(val)?'var(--blue)':'var(--gray2)',borderRadius:'6px',fontWeight:'700',background:att[w.id]==parseFloat(val)?'#dbeafe':'transparent',minWidth:'52px',textAlign:'center'}}>{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 비고 */}
        <div className="card">
          <h2>비고</h2>
          <div className="form-group">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="특이사항 입력..." rows={3} />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : record ? '수정 저장' : '저장'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => router.back()}>취소</button>
        </div>
      </form>
    </>
  );
}
