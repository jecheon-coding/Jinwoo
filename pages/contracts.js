import { useState } from 'react';
import supabase from '../lib/supabase';
import { requireAuth, getRole } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const { data } = await supabase.from('contracts').select('*').order('sort_order').order('id');
  return { props: { role, initialContracts: data || [] } };
}

const empty = {
  name: '', number: '', amount: 0, unit_price: 0,
  area: '', client_name: '', client_recipient_1: '', client_recipient_2: '',
  contract_start: '', contract_end: '', construction_start: '',
  sort_order: 0, active: true,
};

export default function ContractsPage({ initialContracts }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [modal, setModal]         = useState(null);
  const [saving, setSaving]       = useState(false);

  const refresh = async () => {
    const res = await fetch('/api/contracts');
    setContracts(await res.json());
  };

  const openAdd  = () => setModal({ mode: 'add',  data: { ...empty } });
  const openEdit = (c) => setModal({ mode: 'edit', data: { ...c } });
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    setSaving(true);
    const { mode, data } = modal;
    const body = {
      name:               data.name,
      number:             data.number,
      amount:             parseInt(data.amount) || 0,
      unit_price:         parseFloat(data.unit_price) || 0,
      area:               data.area,
      client_name:        data.client_name,
      client_recipient_1: data.client_recipient_1,
      client_recipient_2: data.client_recipient_2,
      contract_start:     data.contract_start || null,
      contract_end:       data.contract_end   || null,
      construction_start: data.construction_start || null,
      sort_order:         parseInt(data.sort_order) || 0,
      active:             data.active,
    };
    if (mode === 'add') {
      await fetch('/api/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/api/contracts/${data.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    closeModal();
    await refresh();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 계약을 삭제하시겠습니까?\n연결된 수거 기록의 계약 정보가 해제됩니다.`)) return;
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const setField = (k, v) => setModal(m => ({ ...m, data: { ...m.data, [k]: v } }));

  return (
    <>
      <div className="page-header">
        <h1>계약 관리</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ 계약 추가</button>
      </div>

      {contracts.length === 0 ? (
        <div className="empty">
          <p>등록된 계약이 없습니다.</p>
          <button className="btn btn-primary" onClick={openAdd}>첫 계약 등록</button>
        </div>
      ) : (
        contracts.map(c => (
          <div key={c.id} className={`worker-card ${!c.active ? 'w-inactive' : ''}`}>
            <div style={{flex:1}}>
              <div style={{fontWeight:'700',fontSize:'15px',marginBottom:'2px'}}>{c.name}</div>
              <div style={{fontSize:'12px',color:'#6b7280'}}>
                {c.area && <span style={{marginRight:'12px'}}>구역: {c.area}</span>}
                {c.number && <span style={{marginRight:'12px'}}>계약번호: {c.number}</span>}
                {c.unit_price > 0 && <span style={{marginRight:'12px'}}>단가: {Number(c.unit_price).toLocaleString()}원/톤</span>}
                {c.amount > 0 && <span>계약금액: {c.amount.toLocaleString()}원</span>}
              </div>
              {!c.active && <span style={{fontSize:'12px',color:'#9ca3af'}}>(비활성)</span>}
            </div>
            <div className="w-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>수정</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}>삭제</button>
            </div>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}
               style={{maxWidth:'520px',maxHeight:'90vh',overflowY:'auto'}}>
            <h3>{modal.mode === 'add' ? '계약 추가' : '계약 수정'}</h3>

            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>계약건명 *</label>
              <input type="text" value={modal.data.name} onChange={e => setField('name', e.target.value)}
                placeholder="예) 2026년 영월군 음식물류폐기물 수집운반 민간위탁 용역(2구역)" />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              {[
                ['number',    '계약번호',          '예) 2026-환경-001', 'text'],
                ['area',      '구역',               '예) 2구역',         'text'],
                ['amount',    '계약금액 (원)',       '177139250',         'number'],
                ['unit_price','수거 단가 (원/톤)',   '180000',            'number'],
                ['client_name','발주처명',           '예) 영월군청',      'text'],
                ['sort_order','정렬 순서',           '0',                 'number'],
              ].map(([k, lbl, ph, type]) => (
                <div className="form-group" style={{marginBottom:'10px'}} key={k}>
                  <label>{lbl}</label>
                  <input type={type} value={modal.data[k] ?? ''} placeholder={ph}
                    onChange={e => setField(k, e.target.value)} />
                </div>
              ))}
            </div>

            {[
              ['client_recipient_1','수신처 1 (재무관)',   '예) 영월군(분임)재무관'],
              ['client_recipient_2','수신처 2 (군수)',      '예) 영월군수'],
            ].map(([k, lbl, ph]) => (
              <div className="form-group" style={{marginBottom:'10px'}} key={k}>
                <label>{lbl}</label>
                <input type="text" value={modal.data[k] ?? ''} placeholder={ph}
                  onChange={e => setField(k, e.target.value)} />
              </div>
            ))}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
              {[
                ['contract_start',     '계약 시작일', 'date'],
                ['contract_end',       '계약 종료일', 'date'],
                ['construction_start', '착공일자',     'date'],
              ].map(([k, lbl, type]) => (
                <div className="form-group" style={{marginBottom:'10px'}} key={k}>
                  <label>{lbl}</label>
                  <input type={type} value={modal.data[k] ?? ''}
                    onChange={e => setField(k, e.target.value)} />
                </div>
              ))}
            </div>

            {modal.mode === 'edit' && (
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <input type="checkbox" id="c-active" checked={modal.data.active}
                  onChange={e => setField('active', e.target.checked)}
                  style={{width:'20px',height:'20px'}} />
                <label htmlFor="c-active" style={{fontSize:'14px',fontWeight:'600',color:'#374151'}}>활성화</label>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave}
                disabled={!modal.data.name || saving}>
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
