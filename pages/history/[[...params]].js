import Link from 'next/link';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabase';
import { requireAuth, getRole } from '../../lib/auth';

function getPeriod(year, month, startDay) {
  const sd = parseInt(startDay) || 1;
  let ps;
  if (sd <= 1) {
    ps = `${year}-${String(month).padStart(2,'0')}-01`;
  } else {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    ps = `${py}-${String(pm).padStart(2,'0')}-${String(sd).padStart(2,'0')}`;
  }
  const lastDay = new Date(year, month, 0).getDate();
  const pe = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  return { ps, pe, lastDay };
}

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, false);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const p    = params?.params || [];
  const today = new Date();
  const year  = parseInt(p[0]) || today.getFullYear();
  const month = parseInt(p[1]) || today.getMonth() + 1;
  const contractIdParam = p[2] ? parseInt(p[2]) : null;
  const sdParam = query.sd ? parseInt(query.sd) : null;

  const [setRes, contRes] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('contracts').select('*').eq('active', true).order('sort_order').order('id'),
  ]);
  const settings  = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });
  const contracts = contRes.data || [];

  // 계약이 없으면 빈 페이지
  if (contracts.length === 0) {
    return { props: { role, records: [], year, month, ps:'', pe:'', lastDay:0, settings, contracts: [], contractId: null, contract: null, startDay: 1 } };
  }

  // contractId 없으면 첫 번째 계약으로 리다이렉트
  if (!contractIdParam) {
    return { redirect: { destination: `/history/${year}/${month}/${contracts[0].id}`, permanent: false } };
  }

  const contractId = contractIdParam;
  const contract   = contracts.find(c => c.id === contractId) || contracts[0];
  const startDay   = sdParam ?? parseInt(settings.period_start_day) ?? 1;

  const { ps, pe, lastDay } = getPeriod(year, month, startDay);

  const { data: records } = await supabase
    .from('records').select('*')
    .eq('contract_id', contractId)
    .gte('record_date', ps).lte('record_date', pe)
    .order('record_date');

  return {
    props: { role, records: records || [], year, month, ps, pe, lastDay, settings, contracts, contractId, contract, startDay },
  };
}

export default function HistoryPage({ role, records, year, month, ps, pe, lastDay, settings, contracts, contractId, contract, startDay }) {
  const router   = useRouter();
  const sdQuery  = `?sd=${startDay}`;
  const totalW   = records.reduce((s,r) => s + (r.weight_1||0) + (r.weight_2||0) + (r.weight_3||0), 0);
  const total3l  = records.reduce((s,r) => s + (r.chip_3l||0), 0);
  const total5l  = records.reduce((s,r) => s + (r.chip_5l||0), 0);
  const total20l = records.reduce((s,r) => s + (r.chip_20l||0), 0);
  const total120l= records.reduce((s,r) => s + (r.chip_120l||0), 0);
  const chipL    = total3l*3 + total5l*5 + total20l*20 + total120l*120;

  const pm = month===1?12:month-1, py=month===1?year-1:year;
  const nm = month===12?1:month+1, ny=month===12?year+1:year;

  const unitPrice = parseFloat(contract?.unit_price) || parseFloat(settings.unit_price) || 0;
  const totalAmt  = Math.floor(totalW * unitPrice / 1000) * 1000;

  const handleDelete = async (date) => {
    if (!confirm(`${date} 기록을 삭제하시겠습니까?`)) return;
    await fetch(`/api/records/${date}?contract_id=${contractId}`, { method: 'DELETE' });
    router.replace(router.asPath);
  };

  if (contracts.length === 0) {
    return (
      <>
        <div className="page-header"><h1>월별 조회</h1></div>
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
        <h1>{year}년 {month}월 운행 기록</h1>
        <div className="btn-group">
          {role === 'admin' && (
            <Link href={`/report/${year}/${month}`} className="btn btn-success">보고서 출력</Link>
          )}
          <Link href={`/daily/${new Intl.DateTimeFormat('sv',{timeZone:'Asia/Seoul'}).format(new Date())}/${contractId}`} className="btn btn-outline">오늘 입력</Link>
        </div>
      </div>

      {/* 계약 탭 */}
      {contracts.length > 1 && (
        <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
          {contracts.map(c => (
            <Link key={c.id} href={`/history/${year}/${month}/${c.id}`}
              className={`btn btn-sm ${c.id === contractId ? 'btn-primary' : 'btn-outline'}`}>
              {c.area || c.name}
            </Link>
          ))}
        </div>
      )}

      {/* 월 이동 */}
      <div className="month-nav">
        <Link href={`/history/${py}/${pm}/${contractId}${sdQuery}`} className="btn btn-outline btn-sm">← 이전달</Link>
        <span className="current">{year}년 {String(month).padStart(2,'0')}월</span>
        <Link href={`/history/${ny}/${nm}/${contractId}${sdQuery}`} className="btn btn-outline btn-sm">다음달 →</Link>
      </div>
      <div style={{textAlign:'center',marginBottom:'12px'}}>
        <span style={{fontSize:'13px',color:'#9ca3af',marginRight:'12px'}}>기간: {ps} ~ {pe}</span>
        {contracts.length > 1 && contract && (
          <span style={{marginRight:'12px',color:'#2563eb',fontWeight:'600',fontSize:'13px'}}>{contract.area || contract.name}</span>
        )}
        <span style={{display:'inline-flex',gap:'4px'}}>
          <Link href={`/history/${year}/${month}/${contractId}?sd=1`}
            className={`btn btn-sm ${startDay <= 1 ? 'btn-primary' : 'btn-outline'}`}>1일~말일</Link>
          <Link href={`/history/${year}/${month}/${contractId}?sd=25`}
            className={`btn btn-sm ${startDay > 1 ? 'btn-primary' : 'btn-outline'}`}>25일~말일</Link>
        </span>
      </div>

      {/* 요약 */}
      <div className="summary-row">
        <div className="summary-card">
          <div className="s-label">근무일수</div>
          <div className="s-value">{records.length}일</div>
        </div>
        <div className="summary-card hl">
          <div className="s-label">총 수거량</div>
          <div className="s-value">{totalW.toFixed(3)}</div>
          <div className="s-sub">톤</div>
        </div>
        <div className="summary-card">
          <div className="s-label">칩 수거량</div>
          <div className="s-value">{chipL.toLocaleString()}</div>
          <div className="s-sub">ℓ</div>
        </div>
        <div className="summary-card">
          <div className="s-label">청구 예정액</div>
          <div className="s-value">{totalAmt.toLocaleString()}</div>
          <div className="s-sub">원</div>
        </div>
      </div>

      {/* 테이블 */}
      {records.length === 0 ? (
        <div className="empty">
          <p>이 달에 입력된 기록이 없습니다.</p>
          <Link href={`/daily/${new Intl.DateTimeFormat('sv',{timeZone:'Asia/Seoul'}).format(new Date())}/${contractId}`}
            className="btn btn-primary">첫 기록 입력</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th><th>1차(톤)</th><th>2차(톤)</th><th>3차(톤)</th><th>합계(톤)</th>
                <th>3L</th><th>5L</th><th>20L</th><th>120L</th><th>칩합계(ℓ)</th>
                <th>횟수</th><th>출력</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const wt = (r.weight_1||0)+(r.weight_2||0)+(r.weight_3||0);
                const cl = (r.chip_3l||0)*3+(r.chip_5l||0)*5+(r.chip_20l||0)*20+(r.chip_120l||0)*120;
                return (
                  <tr key={r.record_date}>
                    <td>{r.record_date.slice(5)}</td>
                    <td className="num">{r.weight_1 ? Number(r.weight_1).toFixed(3) : '-'}</td>
                    <td className="num">{r.weight_2 ? Number(r.weight_2).toFixed(3) : '-'}</td>
                    <td className="num">{r.weight_3 ? Number(r.weight_3).toFixed(3) : '-'}</td>
                    <td className="num bold">{wt.toFixed(3)}</td>
                    <td className="num">{r.chip_3l||0}</td>
                    <td className="num">{r.chip_5l||0}</td>
                    <td className="num">{r.chip_20l||0}</td>
                    <td className="num">{r.chip_120l||0}</td>
                    <td className="num">{cl.toLocaleString()}</td>
                    <td className="num">{r.trips||1}</td>
                    <td>
                      <Link href={`/log/${r.record_date}?contract=${contractId}`}
                        className="btn btn-outline btn-sm">🖨</Link>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:'4px',justifyContent:'center'}}>
                        <Link href={`/daily/${r.record_date}/${contractId}?edit=1`}
                          className="btn btn-outline btn-sm">수정</Link>
                        {role === 'admin' && (
                          <button className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(r.record_date)}>삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>합 계</td>
                <td className="num">-</td><td className="num">-</td><td className="num">-</td>
                <td className="num bold">{totalW.toFixed(3)}</td>
                <td className="num">{total3l}</td><td className="num">{total5l}</td>
                <td className="num">{total20l}</td><td className="num">{total120l}</td>
                <td className="num">{chipL.toLocaleString()}</td>
                <td></td><td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
