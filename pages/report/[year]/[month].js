import Link from 'next/link';
import { useRouter } from 'next/router';
import supabase from '../../../lib/supabase';
import { requireAuth, getRole } from '../../../lib/auth';

function getPeriod(year, month, startDay) {
  const sd = parseInt(startDay) || 1;
  let psDate;
  if (sd <= 1) {
    psDate = new Date(year, month - 1, 1);
  } else {
    psDate = month === 1
      ? new Date(year - 1, 11, sd)
      : new Date(year, month - 2, sd);
  }
  const peDate = new Date(year, month, 0);
  return { psDate, peDate };
}

export async function getServerSideProps({ req, params }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const role  = getRole(req);
  const year  = parseInt(params.year);
  const month = parseInt(params.month);

  const [setRes, contRes] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('contracts').select('*').eq('active', true).order('sort_order').order('id'),
  ]);
  const settings  = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });
  const contracts = contRes.data || [];

  const { psDate, peDate } = getPeriod(year, month, settings.period_start_day);
  const ps = psDate.toISOString().slice(0, 10);
  const pe = peDate.toISOString().slice(0, 10);

  // 계약별 요약 집계
  const recRes = await supabase
    .from('records').select('contract_id,weight_1,weight_2,weight_3')
    .gte('record_date', ps).lte('record_date', pe);

  const records = recRes.data || [];
  const contractStats = {};
  contracts.forEach(c => { contractStats[c.id] = { workDays: 0, totalW: 0 }; });
  records.forEach(r => {
    const cid = r.contract_id;
    if (!contractStats[cid]) return;
    contractStats[cid].workDays++;
    contractStats[cid].totalW += (parseFloat(r.weight_1)||0) + (parseFloat(r.weight_2)||0) + (parseFloat(r.weight_3)||0);
  });

  return {
    props: { role, year, month, ps, pe, contracts, contractStats },
  };
}

export default function ReportMenuPage({ role, year, month, ps, pe, contracts, contractStats }) {
  const router   = useRouter();
  const monthPad = String(month).padStart(2, '0');
  const base     = `/report/${year}/${month}`;

  if (contracts.length === 0) {
    return (
      <>
        <div className="page-header"><h1>{year}년 {monthPad}월 보고서</h1></div>
        <div className="empty">
          <p>등록된 계약이 없습니다.</p>
          <Link href="/contracts" className="btn btn-primary">계약 관리</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>{year}년 {monthPad}월 보고서</h1>
        <button className="btn btn-outline btn-sm" onClick={() => router.back()}>뒤로</button>
      </div>

      <p style={{fontSize:'13px',color:'#9ca3af',marginBottom:'20px'}}>기간: {ps} ~ {pe}</p>

      {contracts.map(c => {
        const stats     = contractStats[c.id] || { workDays: 0, totalW: 0 };
        const unitPrice = parseFloat(c.unit_price) || 0;
        const billing   = Math.floor(stats.totalW * unitPrice / 1000) * 1000;
        const cb        = `${base}?contract=${c.id}`;

        return (
          <div key={c.id} className="card" style={{marginBottom:'16px'}}>
            {/* 계약 헤더 */}
            <div style={{marginBottom:'12px'}}>
              <div style={{fontWeight:'700',fontSize:'15px'}}>{c.name}</div>
              {c.area && <div style={{fontSize:'13px',color:'#6b7280',marginTop:'2px'}}>구역: {c.area}</div>}
            </div>

            {/* 요약 */}
            <div style={{display:'flex',gap:'24px',flexWrap:'wrap',fontSize:'13px',
              color:'#374151',marginBottom:'16px',paddingBottom:'12px',borderBottom:'1px solid #e5e7eb'}}>
              <span><strong>근무일수</strong>　{stats.workDays}일</span>
              <span><strong>총수거량</strong>　{stats.totalW.toFixed(3)} 톤</span>
              <span><strong>청구예정액</strong>　{billing.toLocaleString()} 원</span>
            </div>

            {/* 그룹 버튼 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div style={{border:'1px solid #e5e7eb',borderRadius:'8px',padding:'12px'}}>
                <div style={{fontWeight:'600',marginBottom:'4px'}}>📊 근무현황 보고서</div>
                <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'10px'}}>
                  계근현황 · 칩수거현황 · 일일근무현황 · 근무확인서 (4장)
                </div>
                <Link href={`${cb}&type=work`} className="btn btn-primary btn-sm"
                  style={{display:'block',textAlign:'center'}}>열기 / 인쇄</Link>
              </div>
              <div style={{border:'1px solid #e5e7eb',borderRadius:'8px',padding:'12px'}}>
                <div style={{fontWeight:'600',marginBottom:'4px'}}>📄 기성 / 청구 서류</div>
                <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'10px'}}>
                  대금청구서 · 기성부분검사원 · 기성계 · 노무비청구 · 지급 (5장)
                </div>
                <Link href={`${cb}&type=billing`} className="btn btn-primary btn-sm"
                  style={{display:'block',textAlign:'center'}}>열기 / 인쇄</Link>
              </div>
            </div>

            <div style={{textAlign:'center'}}>
              <Link href={`${cb}&type=all`} className="btn btn-outline btn-sm">
                전체 9장 한번에 출력
              </Link>
            </div>
          </div>
        );
      })}
    </>
  );
}
