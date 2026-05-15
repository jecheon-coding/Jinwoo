import Link from 'next/link';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabase';

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

export async function getServerSideProps({ params }) {
  const p = params?.params || [];
  const today = new Date();
  const year  = parseInt(p[0]) || today.getFullYear();
  const month = parseInt(p[1]) || today.getMonth() + 1;

  const setRes = await supabase.from('settings').select('*');
  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });

  const { ps, pe, lastDay } = getPeriod(year, month, settings.period_start_day);

  const { data: records } = await supabase
    .from('records').select('*')
    .gte('record_date', ps).lte('record_date', pe)
    .order('record_date');

  return {
    props: { records: records || [], year, month, ps, pe, lastDay, settings },
  };
}

export default function HistoryPage({ records, year, month, ps, pe, lastDay, settings }) {
  const router = useRouter();
  const totalW  = records.reduce((s,r) => s + (r.weight_1||0) + (r.weight_2||0) + (r.weight_3||0), 0);
  const total3l = records.reduce((s,r) => s + (r.chip_3l||0), 0);
  const total5l = records.reduce((s,r) => s + (r.chip_5l||0), 0);
  const total20l= records.reduce((s,r) => s + (r.chip_20l||0), 0);
  const total120l=records.reduce((s,r) => s + (r.chip_120l||0), 0);
  const chipL   = total3l*3 + total5l*5 + total20l*20 + total120l*120;

  const pm = month===1?12:month-1, py=month===1?year-1:year;
  const nm = month===12?1:month+1, ny=month===12?year+1:year;

  const unitPrice = parseFloat(settings.unit_price) || 0;
  const totalAmt  = totalW * unitPrice;

  const handleDelete = async (date) => {
    if (!confirm(`${date} 기록을 삭제하시겠습니까?`)) return;
    await fetch(`/api/records/${date}`, { method: 'DELETE' });
    router.replace(router.asPath);
  };

  return (
    <>
      <div className="page-header">
        <h1>{year}년 {month}월 수거 기록</h1>
        <div className="btn-group">
          <Link href={`/report/${year}/${month}`} className="btn btn-success" target="_blank">보고서 출력</Link>
          <Link href={`/daily/${new Date().toISOString().slice(0,10)}`} className="btn btn-outline">오늘 입력</Link>
        </div>
      </div>

      {/* 월 이동 */}
      <div className="month-nav">
        <Link href={`/history/${py}/${pm}`} className="btn btn-outline btn-sm">← 이전달</Link>
        <span className="current">{year}년 {String(month).padStart(2,'0')}월</span>
        <Link href={`/history/${ny}/${nm}`} className="btn btn-outline btn-sm">다음달 →</Link>
      </div>
      <p style={{textAlign:'center',fontSize:'13px',color:'#9ca3af',marginBottom:'16px'}}>
        기간: {ps} ~ {pe}
      </p>

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
          <div className="s-value">{Math.round(totalAmt).toLocaleString()}</div>
          <div className="s-sub">원</div>
        </div>
      </div>

      {/* 테이블 */}
      {records.length === 0 ? (
        <div className="empty">
          <p>이 달에 입력된 기록이 없습니다.</p>
          <Link href={`/daily/${new Date().toISOString().slice(0,10)}`} className="btn btn-primary">첫 기록 입력</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th><th>1차(톤)</th><th>2차(톤)</th><th>3차(톤)</th><th>합계(톤)</th>
                <th>3L</th><th>5L</th><th>20L</th><th>120L</th><th>칩합계(ℓ)</th>
                <th>횟수</th><th>관리</th>
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
                      <div style={{display:'flex',gap:'4px',justifyContent:'center'}}>
                        <Link href={`/daily/${r.record_date}`} className="btn btn-outline btn-sm">수정</Link>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.record_date)}>삭제</button>
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
                <td className="num">{total3l}</td>
                <td className="num">{total5l}</td>
                <td className="num">{total20l}</td>
                <td className="num">{total120l}</td>
                <td className="num">{chipL.toLocaleString()}</td>
                <td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
