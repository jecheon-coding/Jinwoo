import { useState } from 'react';
import supabase from '../lib/supabase';
import { requireAuth, getRole } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const { data } = await supabase.from('workers').select('*').order('sort_order').order('id');
  return { props: { role, initialWorkers: data || [] } };
}

const empty = { name: '', position: '수거원', dob: '', sort_order: 0, active: true, monthly_salary: 0, bank_name: '', bank_account: '', phone: '' };

export default function WorkersPage({ initialWorkers }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);

  const refresh = async () => {
    const res = await fetch('/api/workers');
    setWorkers(await res.json());
  };

  const openAdd  = () => setModal({ mode: 'add',  data: { ...empty } });
  const openEdit = (w) => setModal({ mode: 'edit', data: { ...w } });
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    setSaving(true);
    const { mode, data } = modal;
    const body = {
      name: data.name, position: data.position, dob: data.dob,
      sort_order: parseInt(data.sort_order) || 0,
      monthly_salary: parseInt(data.monthly_salary) || 0,
      bank_name: data.bank_name, bank_account: data.bank_account, phone: data.phone,
    };
    if (mode === 'add') {
      await fetch('/api/workers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch(`/api/workers/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, active: data.active }) });
    }
    setSaving(false);
    closeModal();
    await refresh();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${name}을(를) 삭제하시겠습니까?`)) return;
    await fetch(`/api/workers/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const setField = (k, v) => setModal(m => ({ ...m, data: { ...m.data, [k]: v } }));

  return (
    <>
      <div className="page-header">
        <h1>작업자 관리</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ 작업자 추가</button>
      </div>

      {workers.length === 0 ? (
        <div className="empty">
          <p>등록된 작업자가 없습니다.</p>
          <button className="btn btn-primary" onClick={openAdd}>첫 작업자 등록</button>
        </div>
      ) : (
        workers.map(w => (
          <div key={w.id} className={`worker-card ${!w.active ? 'w-inactive' : ''}`}>
            <span className="w-name">{w.name}</span>
            <span className="w-pos">{w.position}</span>
            <span className="w-dob">{w.dob || '-'}</span>
            <span style={{fontSize:'13px',color:'#374151',minWidth:'120px'}}>
              {w.monthly_salary ? (parseInt(w.monthly_salary)).toLocaleString() + '원' : '-'}
            </span>
            <span style={{fontSize:'12px',color:'#9ca3af'}}>{w.bank_name} {w.bank_account}</span>
            {!w.active && <span style={{fontSize:'12px',color:'#9ca3af'}}>(비활성)</span>}
            <div className="w-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(w)}>수정</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(w.id, w.name)}>삭제</button>
            </div>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'480px',maxHeight:'90vh',overflowY:'auto'}}>
            <h3>{modal.mode === 'add' ? '작업자 추가' : '작업자 수정'}</h3>

            {[
              ['name','이름 *','홍길동','text'],
              ['dob','생년월일','예) 81.03.10','text'],
              ['monthly_salary','월 급여 (원)','3000000','number'],
              ['bank_name','은행명','예) 신한은행','text'],
              ['bank_account','계좌번호','000-000-000000','text'],
              ['phone','전화번호','010-0000-0000','text'],
              ['sort_order','정렬 순서','0','number'],
            ].map(([k, lbl, ph, type]) => (
              <div className="form-group" style={{marginBottom:'10px'}} key={k}>
                <label>{lbl}</label>
                <input type={type} value={modal.data[k] ?? ''} onChange={e => setField(k, e.target.value)} placeholder={ph} />
              </div>
            ))}

            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>직위</label>
              <select value={modal.data.position} onChange={e => setField('position', e.target.value)}>
                <option value="운전원">운전원</option>
                <option value="수거원">수거원</option>
                <option value="반장">반장</option>
              </select>
            </div>

            {modal.mode === 'edit' && (
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <input type="checkbox" id="active" checked={modal.data.active}
                  onChange={e => setField('active', e.target.checked)} style={{width:'20px',height:'20px'}} />
                <label htmlFor="active" style={{fontSize:'14px',fontWeight:'600',color:'#374151'}}>활성화</label>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={!modal.data.name || saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button className="btn btn-outline" onClick={closeModal}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
