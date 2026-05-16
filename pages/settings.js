import { useState } from 'react';
import supabase from '../lib/supabase';
import { requireAuth, getRole } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const { data } = await supabase.from('settings').select('*');
  const settings = {};
  (data || []).forEach(r => { settings[r.key] = r.value; });
  return { props: { role, initialSettings: settings } };
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

        {/* 공급자 정보 */}
        <div className="card">
          <h2>공급자 (청구인) 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>회사명 / 상호</label>
              <input type="text" value={form.company_name||''} onChange={e=>set('company_name',e.target.value)} placeholder="예) (주)진우환경" />
            </div>
            <div className="form-group">
              <label>대표자명</label>
              <input type="text" value={form.ceo_name||''} onChange={e=>set('ceo_name',e.target.value)} placeholder="예) 지해옥" />
            </div>
            <div className="form-group">
              <label>사업자등록번호</label>
              <input type="text" value={form.company_reg||''} onChange={e=>set('company_reg',e.target.value)} placeholder="000-00-00000" />
            </div>
            <div className="form-group">
              <label>전화번호</label>
              <input type="text" value={form.company_tel||''} onChange={e=>set('company_tel',e.target.value)} placeholder="033-000-0000" />
            </div>
            <div className="form-group col-span-2">
              <label>주소</label>
              <input type="text" value={form.company_addr||''} onChange={e=>set('company_addr',e.target.value)} />
            </div>
          </div>
        </div>

        {/* 입금 계좌 */}
        <div className="card">
          <h2>입금 계좌 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>은행명</label>
              <input type="text" value={form.bank_name||''} onChange={e=>set('bank_name',e.target.value)} placeholder="예) 신한은행" />
            </div>
            <div className="form-group">
              <label>계좌번호</label>
              <input type="text" value={form.bank_account||''} onChange={e=>set('bank_account',e.target.value)} placeholder="000-000-000000" />
            </div>
            <div className="form-group">
              <label>예금 종류</label>
              <input type="text" value={form.bank_type||''} onChange={e=>set('bank_type',e.target.value)} placeholder="예) 기업자유예금" />
            </div>
          </div>
        </div>

        {/* 요금 및 기간 */}
        <div className="card">
          <h2>요금 및 기간 설정</h2>
          <p style={{fontSize:'12px',color:'#9ca3af',marginBottom:'10px'}}>
            수거 단가, 계약 정보, 발주처 정보는 <a href="/contracts" style={{color:'#2563eb'}}>계약 관리</a>에서 계약별로 설정하세요.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>보고서 기간 시작일 (전월 기준)</label>
              <input type="number" min="1" max="31" value={form.period_start_day||27} onChange={e=>set('period_start_day',e.target.value)} />
              <span style={{fontSize:'12px',color:'#9ca3af'}}>예) 27 → 전월 27일 ~ 당월 말일</span>
            </div>
            <div className="form-group">
              <label>노무비 지급일 (일)</label>
              <input type="number" min="1" max="31" value={form.salary_payment_day||16} onChange={e=>set('salary_payment_day',e.target.value)} />
              <span style={{fontSize:'12px',color:'#9ca3af'}}>예) 16 → 매월 16일 지급</span>
            </div>
          </div>
        </div>

        {/* 차량 기본값 */}
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

        {/* 접근 비밀번호 */}
        <div className="card">
          <h2>접근 비밀번호</h2>
          <p style={{fontSize:'12px',color:'#9ca3af',marginBottom:'10px'}}>
            비밀번호를 비워두면 기본값(관리자: admin / 사용자: user)이 사용됩니다.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>관리자 비밀번호</label>
              <input type="text" value={form.admin_password||''} onChange={e=>set('admin_password',e.target.value)} placeholder="관리자용 비밀번호" />
            </div>
            <div className="form-group">
              <label>사용자 비밀번호 (작업자용)</label>
              <input type="text" value={form.user_password||''} onChange={e=>set('user_password',e.target.value)} placeholder="작업자용 비밀번호" />
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
