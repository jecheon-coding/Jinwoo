import { useState } from 'react';
import supabase from '../lib/supabase';

export async function getServerSideProps() {
  const { data } = await supabase.from('settings').select('*');
  const settings = {};
  (data || []).forEach(r => { settings[r.key] = r.value; });
  return { props: { initialSettings: settings } };
}

export default function SettingsPage({ initialSettings }) {
  const [form, setForm]     = useState(initialSettings);
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      <div className="page-header">
        <h1>설정</h1>
        {saved && <span style={{color:'#16a34a',fontWeight:'700'}}>✓ 저장됨</span>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>공급자 (청구인) 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>회사명 / 상호</label>
              <input type="text" value={form.company_name||''} onChange={e=>set('company_name',e.target.value)} placeholder="예) 진우환경" />
            </div>
            <div className="form-group">
              <label>사업자등록번호</label>
              <input type="text" value={form.company_reg||''} onChange={e=>set('company_reg',e.target.value)} placeholder="000-00-00000" />
            </div>
            <div className="form-group col-span-2">
              <label>주소</label>
              <input type="text" value={form.company_addr||''} onChange={e=>set('company_addr',e.target.value)} />
            </div>
            <div className="form-group">
              <label>전화번호</label>
              <input type="text" value={form.company_tel||''} onChange={e=>set('company_tel',e.target.value)} placeholder="000-0000-0000" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>발주처 (공급받는자) 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>발주처명</label>
              <input type="text" value={form.client_name||''} onChange={e=>set('client_name',e.target.value)} placeholder="예) 영월군청" />
            </div>
            <div className="form-group">
              <label>구역</label>
              <input type="text" value={form.area||''} onChange={e=>set('area',e.target.value)} placeholder="예) 2구역" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>계약 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>계약번호</label>
              <input type="text" value={form.contract_number||''} onChange={e=>set('contract_number',e.target.value)} placeholder="예) 2026-환경-001" />
            </div>
            <div className="form-group">
              <label>계약 시작일</label>
              <input type="date" value={form.contract_start||''} onChange={e=>set('contract_start',e.target.value)} />
            </div>
            <div className="form-group">
              <label>계약 종료일</label>
              <input type="date" value={form.contract_end||''} onChange={e=>set('contract_end',e.target.value)} />
            </div>
            <div className="form-group">
              <label>수거 단가 (원/톤)</label>
              <input type="number" step="0.01" value={form.unit_price||0} onChange={e=>set('unit_price',e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>보고서 기간 설정</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>보고서 기간 시작일 (전월 기준)</label>
              <input type="number" min="1" max="31" value={form.period_start_day||27} onChange={e=>set('period_start_day',e.target.value)} />
              <span style={{fontSize:'12px',color:'#9ca3af'}}>예) 27 → 전월 27일 ~ 당월 말일</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>차량 / 운전자 기본값</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>기본 차량번호</label>
              <input type="text" value={form.vehicle_number||''} onChange={e=>set('vehicle_number',e.target.value)} placeholder="89오4821" />
            </div>
            <div className="form-group">
              <label>기본 운전자</label>
              <input type="text" value={form.driver||''} onChange={e=>set('driver',e.target.value)} placeholder="이름" />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </form>
    </>
  );
}
