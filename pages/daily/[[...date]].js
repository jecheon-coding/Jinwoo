import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import supabase from '../../lib/supabase';
import { requireAuth, getRole } from '../../lib/auth';

function getKSTDate() {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, false);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const dateParam     = params?.date?.[0];
  const contractIdStr = params?.date?.[1];
  const contractId    = contractIdStr ? parseInt(contractIdStr) : null;
  const editMode      = query.edit === '1';
  const today         = getKSTDate();
  const recordDate    = dateParam || today;

  // 날짜가 없으면 오늘로 리다이렉트
  if (!dateParam) {
    return { redirect: { destination: `/daily/${today}`, permanent: false } };
  }

  const [contRes, setRes] = await Promise.all([
    supabase.from('contracts').select('*').eq('active', true).order('sort_order').order('id'),
    supabase.from('settings').select('*'),
  ]);

  if (contRes.error) {
    console.error('[daily] contracts fetch error:', contRes.error);
    return { props: { role, recordDate, contracts: [], settings: {}, mode: 'db-error' } };
  }

  const contracts = contRes.data || [];
  const settings  = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });

  // 계약이 없으면 계약 없음 화면
  if (contracts.length === 0) {
    return { props: { role, recordDate, contracts: [], settings, mode: 'no-contract' } };
  }

  // contractId 없고 계약이 1개면 바로 리다이렉트
  if (!contractId) {
    if (contracts.length === 1) {
      return { redirect: { destination: `/daily/${recordDate}/${contracts[0].id}`, permanent: false } };
    }
    // 계약 선택 화면
    return { props: { role, recordDate, contracts, settings, mode: 'select' } };
  }

  // 계약 ID가 있으면 입력폼
  const contract = contracts.find(c => c.id === contractId) || null;

  const [wRes, prevRecRes, attRes, recRes] = await Promise.all([
    supabase.from('workers').select('*').eq('active', true).order('sort_order').order('id'),
    supabase.from('records').select('end_km').lt('record_date', recordDate).eq('contract_id', contractId).order('record_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('attendance').select('*').eq('record_date', recordDate).eq('contract_id', contractId),
    supabase.from('records').select('*').eq('record_date', recordDate).eq('contract_id', contractId).maybeSingle(),
  ]);

  let record = recRes?.data || null;
  let attData = attRes?.data || [];

  // 레거시 레코드 fallback (contract_id 없는 이전 데이터)
  if (!record && contractId) {
    const [legacyRec, legacyAtt] = await Promise.all([
      supabase.from('records').select('*').eq('record_date', recordDate).is('contract_id', null).maybeSingle(),
      supabase.from('attendance').select('*').eq('record_date', recordDate).is('contract_id', null),
    ]);
    record  = legacyRec.data || null;
    attData = legacyAtt.data || attData;
  }

  const attMap = {};
  attData.forEach(a => { attMap[a.worker_id] = a.value; });

  const prevEndKm = prevRecRes.data?.end_km ?? null;

  return {
    props: {
      role, recordDate, contracts, settings,
      mode: 'form',
      contract, contractId,
      record,
      workers: wRes.data || [],
      attMap,
      prevEndKm,
    },
  };
}

export default function DailyPage(props) {
  const { role, recordDate, contracts, settings, mode } = props;
  const router = useRouter();

  // ── DB 오류 (첫 접속 cold start 등)
  if (mode === 'db-error') {
    return (
      <>
        <div className="page-header"><h1>일일 운행 입력</h1></div>
        <div className="empty">
          <p style={{color:'#dc2626'}}>데이터를 불러오지 못했습니다.</p>
          <p style={{color:'#6b7280',fontSize:'13px',marginBottom:'16px'}}>
            잠시 후 다시 시도해 주세요.
          </p>
          <button className="btn btn-primary" onClick={() => router.reload()}>
            새로고침
          </button>
        </div>
      </>
    );
  }

  // ── 계약 없음
  if (mode === 'no-contract') {
    return (
      <>
        <div className="page-header"><h1>일일 운행 입력</h1></div>
        <div className="empty">
          <p>등록된 계약이 없습니다.</p>
          {role === 'admin'
            ? <Link href="/contracts" className="btn btn-primary">계약 관리</Link>
            : <p style={{color:'#9ca3af',fontSize:'14px'}}>관리자에게 문의하세요.</p>
          }
        </div>
      </>
    );
  }

  // ── 계약 선택
  if (mode === 'select') {
    return (
      <>
        <div className="page-header">
          <h1>계약 선택</h1>
          <span style={{fontSize:'14px',color:'#6b7280'}}>{recordDate}</span>
        </div>
        <p style={{marginBottom:'16px',color:'#6b7280',fontSize:'13px'}}>
          오늘 작업할 계약(구역)을 선택하세요.
        </p>
        <div style={{display:'grid',gap:'12px'}}>
          {contracts.map(c => (
            <Link key={c.id} href={`/daily/${recordDate}/${c.id}`}
              style={{textDecoration:'none'}}>
              <div className="card" style={{cursor:'pointer',borderLeft:'4px solid #2563eb'}}>
                <div style={{fontWeight:'700',fontSize:'15px'}}>{c.name}</div>
                <div style={{fontSize:'13px',color:'#6b7280',marginTop:'4px'}}>
                  {c.area && <span style={{marginRight:'16px'}}>구역: {c.area}</span>}
                  {c.client_name && <span>발주처: {c.client_name}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </>
    );
  }

  // ── 입력 폼
  return <DailyForm key={`${props.recordDate}-${props.contractId}`} {...props} router={router} />;
}

function DailyForm({ role, recordDate, contracts, settings, contract, contractId, record, workers, attMap, prevEndKm, router }) {
  const isSaturday = new Date(recordDate).getDay() === 6;
  const isUser = role === 'user';
  const today = new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(new Date());
  const isPastDate = isUser && recordDate < today;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    record_date:    recordDate,
    contract_id:    contractId,
    vehicle_number: record?.vehicle_number ?? settings.vehicle_number ?? '',
    driver:         record?.driver         ?? settings.driver ?? '',
    route:          record?.route          ?? contract?.area ?? '',
    op_start:       record?.op_start       ?? '06:00',
    op_end:         record?.op_end         ?? '',
    trips:          record?.trips          ?? 1,
    start_km:       record?.start_km       ?? prevEndKm ?? '',
    end_km:         record?.end_km         ?? '',
    fuel:           record?.fuel           ?? '',
    fuel_cost:      record?.fuel_cost      ?? '',
    urea:           record?.urea           ?? '',
    urea_cost:      record?.urea_cost      ?? '',
    fuel_note:      record?.fuel_note      ?? '',
    meal_cost:      record?.meal_cost      ?? '',
    other_cost:     record?.other_cost     ?? '',
    other_note:     record?.other_note     ?? '',
    weight_1:       record?.weight_1 != null ? Math.round(parseFloat(record.weight_1) * 1000) : '',
    weight_2:       record?.weight_2 != null ? Math.round(parseFloat(record.weight_2) * 1000) : '',
    weight_3:       record?.weight_3 != null ? Math.round(parseFloat(record.weight_3) * 1000) : '',
    chip_3l:        record?.chip_3l        ?? 0,
    chip_5l:        record?.chip_5l        ?? 0,
    chip_20l:       record?.chip_20l       ?? 0,
    chip_120l:      record?.chip_120l      ?? 0,
    notes:          record?.notes          ?? '',
  });
  const [att, setAtt] = useState(() => {
    const init = {};
    const defaultVal = isSaturday ? 0.5 : 1.0;
    workers.forEach(w => { init[w.id] = attMap[w.id] ?? defaultVal; });
    return init;
  });

  const totalWkg = (parseFloat(form.weight_1)||0) + (parseFloat(form.weight_2)||0) + (parseFloat(form.weight_3)||0);
  const totalW   = totalWkg / 1000;
  const sub3     = (parseInt(form.chip_3l)  ||0) * 3;
  const sub5     = (parseInt(form.chip_5l)  ||0) * 5;
  const sub20    = (parseInt(form.chip_20l) ||0) * 20;
  const sub120   = (parseInt(form.chip_120l)||0) * 120;
  const chipTotal = sub3 + sub5 + sub20 + sub120;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDateChange = (newDate) => {
    router.push(`/daily/${newDate}/${contractId}`);
  };

  const handleContractChange = (newCid) => {
    router.push(`/daily/${form.record_date}/${newCid}`);
  };

  const doSave = async (redirectTo) => {
    setSaving(true);
    const attendance = workers.map(w => ({ worker_id: w.id, value: att[w.id] ?? 0 }));
    const body = { ...form, attendance };
    ['weight_1','weight_2','weight_3'].forEach(k => { body[k] = (parseFloat(body[k]) || 0) / 1000; });
    ['chip_3l','chip_5l','chip_20l','chip_120l','trips'].forEach(k => { body[k] = parseInt(body[k]) || 0; });
    ['start_km','end_km','fuel','urea','fuel_cost','urea_cost','meal_cost','other_cost'].forEach(k => { body[k] = body[k] !== '' && body[k] != null ? parseFloat(body[k]) : null; });

    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) router.push(redirectTo);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!confirm('저장하시겠습니까?')) return;
    const d = form.record_date;
    doSave(`/history/${d.slice(0,4)}/${parseInt(d.slice(5,7))}/${contractId}`);
  };

  const handleSaveAndPrint = (e) => {
    e.preventDefault();
    doSave(`/log/${form.record_date}?contract=${contractId}`);
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm('이 날의 기록을 삭제하시겠습니까?')) return;
    await fetch(`/api/records/${form.record_date}?contract_id=${contractId}`, { method: 'DELETE' });
    const d = form.record_date;
    router.push(`/daily/${d}/${contractId}`);
  };

  return (
    <>
      <div className="page-header">
        <h1>일일 운행 입력</h1>
        <div className="btn-group">
        </div>
      </div>

      {/* 계약 선택 탭 (복수 계약일 때) */}
      {contracts.length > 1 && (
        <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
          {contracts.map(c => (
            <button key={c.id}
              onClick={() => handleContractChange(c.id)}
              className={`btn btn-sm ${c.id === contractId ? 'btn-primary' : 'btn-outline'}`}>
              {c.area || c.name}
            </button>
          ))}
        </div>
      )}

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
              <input type="text" value={form.vehicle_number}
                onChange={e => set('vehicle_number', e.target.value)} placeholder="89오4821" />
            </div>
            <div className="form-group">
              <label>운전자</label>
              <input type="text" value={form.driver}
                onChange={e => set('driver', e.target.value)} placeholder="이름" />
            </div>
            <div className="form-group">
              <label>행선지 / 구역</label>
              <input type="text" value={form.route}
                onChange={e => set('route', e.target.value)} placeholder="예) 영월읍(2구역) 지역내 음식물 수집.운반" />
            </div>
            <div className="form-group">
              <label>운행시작</label>
              <TimePicker24h value={form.op_start} defaultHour="06"
                onChange={v => set('op_start', v)} />
            </div>
            <div className="form-group">
              <label>운행종료</label>
              <TimePicker24h value={form.op_end} defaultHour="18"
                onChange={v => set('op_end', v)} />
            </div>
            <div className="form-group">
              <label>운행횟수</label>
              <input type="number" min="1" value={form.trips}
                onChange={e => set('trips', e.target.value)} />
            </div>
            <div className="form-group">
              <label>시작 km</label>
              <input type="number" step="0.001" value={form.start_km}
                onChange={e => set('start_km', e.target.value)} placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>종료 km</label>
              <input type="number" step="0.001" value={form.end_km}
                onChange={e => set('end_km', e.target.value)} placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>주유량 (ℓ)</label>
              <input type="number" step="0.1" value={form.fuel}
                onChange={e => set('fuel', e.target.value)} placeholder="0.0" />
            </div>
            <div className="form-group">
              <label>요소수 (개)</label>
              <input type="number" step="1" value={form.urea}
                onChange={e => set('urea', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>기타</label>
              <input type="text" value={form.fuel_note}
                onChange={e => set('fuel_note', e.target.value)} placeholder="" />
            </div>
          </div>
        </div>

        {/* 비용 지출 */}
        <div className="card">
          <h2>비용 지출</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>주유비 (원)</label>
              <input type="number" min="0" step="1" value={form.fuel_cost}
                onChange={e => set('fuel_cost', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>요소수 비용 (원)</label>
              <input type="number" min="0" step="1" value={form.urea_cost}
                onChange={e => set('urea_cost', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>식비 (원)</label>
              <input type="number" min="0" step="1" value={form.meal_cost}
                onChange={e => set('meal_cost', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>기타 비용 (원)</label>
              <input type="number" min="0" step="1" value={form.other_cost}
                onChange={e => set('other_cost', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>기타 내용</label>
              <input type="text" value={form.other_note}
                onChange={e => set('other_note', e.target.value)} placeholder="" />
            </div>
          </div>
          {(() => {
            const total = (parseFloat(form.fuel_cost)||0) + (parseFloat(form.urea_cost)||0)
              + (parseFloat(form.meal_cost)||0) + (parseFloat(form.other_cost)||0);
            return total > 0 ? (
              <div style={{marginTop:'10px',fontWeight:'700',color:'#1e40af'}}>
                합계: {total.toLocaleString()} 원
              </div>
            ) : null;
          })()}
        </div>

        {/* 계근 */}
        <div className="card">
          <h2>실중량 계근</h2>
          <div className="form-grid form-grid-4">
            {[['weight_1','1차'],['weight_2','2차'],['weight_3','3차']].map(([k,lbl]) => (
              <div className="form-group" key={k}>
                <label>{lbl} (kg)</label>
                <input type="number" step="1" min="0" value={form[k]}
                  onChange={e => set(k, e.target.value)} placeholder="0" />
              </div>
            ))}
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
                <input type="number" min="0" value={form[k]}
                  onChange={e => set(k, e.target.value)} />
                <span style={{fontSize:'12px',color:'#6b7280'}}>소계: {sub.toLocaleString()} ℓ</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:'10px',fontWeight:'700',color:'#1e40af'}}>
            합계: {chipTotal.toLocaleString()} ℓ
          </div>
        </div>

        {/* 작업자 출근 */}
        {role === 'admin' && workers.length > 0 && (
          <div className="card">
            <h2>작업자 출근 현황</h2>
            <div className="att-grid">
              {workers.map(w => (
                <div className="att-row" key={w.id}>
                  <span className="att-name">{w.name}</span>
                  <span className="att-pos">{w.position}</span>
                  <div className="att-options">
                    {[['1.0','전일','full'],['0.5','반일','half'],['0.0','미출','zero']].map(([val,lbl,cls]) => (
                      <label key={val} className={`att-option ${cls}`}
                        style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:'2px'}}>
                        <input type="radio" name={`att_${w.id}`}
                          checked={String(att[w.id]) === val}
                          onChange={() => setAtt(a => ({...a, [w.id]: parseFloat(val)}))} />
                        <span style={{padding:'6px 12px',border:'2px solid',
                          borderColor: att[w.id]===parseFloat(val)?'var(--blue)':'var(--gray2)',
                          borderRadius:'6px',fontWeight:'700',
                          background: att[w.id]===parseFloat(val)?'#dbeafe':'transparent',
                          minWidth:'52px',textAlign:'center'}}>{lbl}</span>
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
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="특이사항 입력..." rows={3} />
          </div>
        </div>

        {isPastDate && (
          <div style={{
            background: '#fef9c3', border: '1px solid #fde047',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#854d0e', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{fontSize:'16px'}}>⚠️</span>
            <span>과거 날짜를 수정합니다.</span>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : record ? '수정 저장' : '저장'}
          </button>
          {!isUser && (
            <button type="button" className="btn btn-success" disabled={saving}
              onClick={handleSaveAndPrint}>
              {saving ? '저장 중...' : '🖨 저장 후 출력'}
            </button>
          )}
          {role === 'admin' && (
            <button type="button" className="btn btn-outline" onClick={() => router.back()}>취소</button>
          )}
        </div>
      </form>
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS  = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function TimePicker24h({ value, onChange, defaultHour }) {
  const [h, m] = value ? value.split(':') : ['', ''];

  const selStyle = {
    border: '1px solid var(--gray2)', borderRadius: '6px',
    padding: '9px 4px', fontSize: '15px', fontFamily: 'inherit',
    minHeight: '44px', flex: 1, textAlign: 'center',
  };

  const update = (newH, newM) => {
    const hh = newH !== '' ? newH : (defaultHour || '00');
    const mm = newM !== '' ? newM : '00';
    if (newH === '' && newM === '') { onChange(''); return; }
    onChange(`${hh}:${mm}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <select value={h} style={selStyle}
        onChange={e => update(e.target.value, m)}>
        <option value="">--</option>
        {HOURS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span style={{ fontWeight: '700', fontSize: '16px' }}>:</span>
      <select value={m || (h ? '00' : '')} style={selStyle}
        onChange={e => update(h || defaultHour || '00', e.target.value)}>
        <option value="">--</option>
        {MINS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}
