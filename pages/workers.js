import { useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabase';

export async function getServerSideProps() {
  const { data } = await supabase
    .from('workers').select('*').order('sort_order').order('id');
  return { props: { initialWorkers: data || [] } };
}

const empty = { name: '', position: '수거원', dob: '', sort_order: 0, active: true };

export default function WorkersPage({ initialWorkers }) {
  const router  = useRouter();
  const [workers, setWorkers] = useState(initialWorkers);
  const [modal, setModal]     = useState(null); // null | {mode:'add'|'edit', data}
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
    if (mode === 'add') {
      await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, position: data.position, dob: data.dob, sort_order: parseInt(data.sort_order)||0 }),
      });
    } else {
      await fetch(`/api/workers/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, position: data.position, dob: data.dob, sort_order: parseInt(data.sort_order)||0, active: data.active }),
      });
    }
    setSaving(false);
    closeModal();
    await refresh();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${name}을(를) 삭제하시겠습니까?\n관련 출근 기록도 모두 삭제됩니다.`)) return;
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
            {!w.active && <span style={{fontSize:'12px',color:'#9ca3af'}}>(비활성)</span>}
            <div className="w-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(w)}>수정</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(w.id, w.name)}>삭제</button>
            </div>
          </div>
        ))
      )}

      {/* 모달 */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.mode === 'add' ? '작업자 추가' : '작업자 수정'}</h3>
            <div className="form-group" style={{marginBottom:'12px'}}>
              <label>이름 *</label>
              <input type="text" value={modal.data.name} onChange={e => setField('name', e.target.value)} placeholder="홍길동" />
            </div>
            <div className="form-group" style={{marginBottom:'12px'}}>
              <label>직위</label>
              <select value={modal.data.position} onChange={e => setField('position', e.target.value)}>
                <option value="운전원">운전원</option>
                <option value="수거원">수거원</option>
                <option value="반장">반장</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:'12px'}}>
              <label>생년월일</label>
              <input type="text" value={modal.data.dob} onChange={e => setField('dob', e.target.value)} placeholder="예) 81.03.10" />
            </div>
            <div className="form-group" style={{marginBottom:'12px'}}>
              <label>정렬 순서 (숫자 낮을수록 상단)</label>
              <input type="number" value={modal.data.sort_order} onChange={e => setField('sort_order', e.target.value)} />
            </div>
            {modal.mode === 'edit' && (
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <input type="checkbox" id="active" checked={modal.data.active}
                  onChange={e => setField('active', e.target.checked)} style={{width:'20px',height:'20px'}} />
                <label htmlFor="active" style={{fontSize:'14px',fontWeight:'600',color:'#374151'}}>활성화 (일일 입력에 표시)</label>
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
