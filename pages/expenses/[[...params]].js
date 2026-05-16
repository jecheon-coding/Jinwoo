import { useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabase';
import { requireAuth, getRole } from '../../lib/auth';

export async function getServerSideProps({ req, params }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const role = getRole(req);
  const now   = new Date();
  const year  = params?.params?.[0] ? parseInt(params.params[0]) : now.getFullYear();
  const month = params?.params?.[1] ? parseInt(params.params[1]) : now.getMonth() + 1;

  if (!params?.params?.[0]) {
    return { redirect: { destination: `/expenses/${now.getFullYear()}/${now.getMonth() + 1}`, permanent: false } };
  }

  const ps = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const pe = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  // 월별 상세 + 연간 통계 동시 조회
  const [monthRes, yearRes] = await Promise.all([
    supabase.from('records')
      .select('record_date,fuel_cost,urea_cost,meal_cost,other_cost,other_note')
      .gte('record_date', ps).lte('record_date', pe)
      .order('record_date'),
    supabase.from('records')
      .select('record_date,fuel_cost,urea_cost,meal_cost,other_cost')
      .gte('record_date', `${year}-01-01`).lte('record_date', `${year}-12-31`),
  ]);

  // 날짜별 합산 (다중 계약 대응)
  const byDate = {};
  (monthRes.data || []).forEach(r => {
    if (!byDate[r.record_date]) byDate[r.record_date] = { fuel_cost:0, urea_cost:0, meal_cost:0, other_cost:0, other_note:'' };
    byDate[r.record_date].fuel_cost  += parseFloat(r.fuel_cost)  || 0;
    byDate[r.record_date].urea_cost  += parseFloat(r.urea_cost)  || 0;
    byDate[r.record_date].meal_cost  += parseFloat(r.meal_cost)  || 0;
    byDate[r.record_date].other_cost += parseFloat(r.other_cost) || 0;
    if (r.other_note) byDate[r.record_date].other_note = r.other_note;
  });
  const rows = Object.entries(byDate).map(([date, v]) => ({ date, ...v }));
  const summary = rows.reduce(
    (acc, r) => { acc.fuel_cost+=r.fuel_cost; acc.urea_cost+=r.urea_cost; acc.meal_cost+=r.meal_cost; acc.other_cost+=r.other_cost; return acc; },
    { fuel_cost:0, urea_cost:0, meal_cost:0, other_cost:0 }
  );

  // 월별 합산 (연간)
  const byMonth = Array.from({length:12}, (_,i) => ({ m:i+1, fuel_cost:0, urea_cost:0, meal_cost:0, other_cost:0 }));
  (yearRes.data || []).forEach(r => {
    const m = parseInt(r.record_date.slice(5,7)) - 1;
    byMonth[m].fuel_cost  += parseFloat(r.fuel_cost)  || 0;
    byMonth[m].urea_cost  += parseFloat(r.urea_cost)  || 0;
    byMonth[m].meal_cost  += parseFloat(r.meal_cost)  || 0;
    byMonth[m].other_cost += parseFloat(r.other_cost) || 0;
  });

  return { props: { role, year, month, rows, summary, byMonth } };
}

function fmt(v) { return v ? Number(v).toLocaleString() : '-'; }
function rowTotal(r) { return (r.fuel_cost||0)+(r.urea_cost||0)+(r.meal_cost||0)+(r.other_cost||0); }

export default function ExpensesPage({ year, month, rows, summary, byMonth }) {
  const [tab, setTab] = useState('detail');
  const prevMonth = month === 1 ? `${year-1}/12` : `${year}/${month-1}`;
  const nextMonth = month === 12 ? `${year+1}/1` : `${year}/${month+1}`;
  const grandTotal = summary.fuel_cost + summary.urea_cost + summary.meal_cost + summary.other_cost;

  return (
    <>
      <div className="page-header">
        <h1>비용 관리</h1>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'2px solid #e5e7eb' }}>
        {[['detail','월별 상세'],['stats','연간 통계']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding:'8px 20px', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:'600',
              background:'none', borderBottom: tab===key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab===key ? '#2563eb' : '#6b7280', marginBottom:'-2px',
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'detail' && (
        <DetailTab
          year={year} month={month} rows={rows} summary={summary}
          grandTotal={grandTotal} prevMonth={prevMonth} nextMonth={nextMonth}
        />
      )}
      {tab === 'stats' && (
        <StatsTab year={year} byMonth={byMonth} />
      )}
    </>
  );
}

function DetailTab({ year, month, rows, summary, grandTotal, prevMonth, nextMonth }) {
  return (
    <>
      {/* 월 네비게이션 */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <Link href={`/expenses/${prevMonth}`} className="btn btn-outline btn-sm">◀ 이전 달</Link>
        <span style={{ fontWeight:'700', fontSize:'18px' }}>{year}년 {month}월</span>
        <Link href={`/expenses/${nextMonth}`} className="btn btn-outline btn-sm">다음 달 ▶</Link>
      </div>

      {/* 월간 합계 */}
      <div className="card" style={{ marginBottom:'20px' }}>
        <h2>월간 합계</h2>
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:'12px' }}>
          <thead>
            <tr style={{ background:'#f1f5f9' }}>
              <th style={th}>항목</th>
              <th style={{...th, textAlign:'right'}}>금액 (원)</th>
            </tr>
          </thead>
          <tbody>
            {[['주유비',summary.fuel_cost],['요소수 비용',summary.urea_cost],['식비',summary.meal_cost],['기타 비용',summary.other_cost]].map(([label,val]) => (
              <tr key={label} style={{ borderBottom:'1px solid #e5e7eb' }}>
                <td style={td}>{label}</td>
                <td style={{...td, textAlign:'right'}}>{val ? val.toLocaleString() : '-'}</td>
              </tr>
            ))}
            <tr style={{ background:'#eff6ff', fontWeight:'700' }}>
              <td style={td}>합계</td>
              <td style={{...td, textAlign:'right', color:'#1e40af'}}>{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 일별 상세 */}
      <div className="card">
        <h2>일별 상세</h2>
        {rows.length === 0 ? (
          <p style={{ color:'#9ca3af', marginTop:'12px' }}>이 달의 비용 데이터가 없습니다.</p>
        ) : (
          <div style={{ overflowX:'auto', marginTop:'12px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
              <thead>
                <tr style={{ background:'#f1f5f9' }}>
                  <th style={th}>날짜</th>
                  <th style={{...th,textAlign:'right'}}>주유비</th>
                  <th style={{...th,textAlign:'right'}}>요소수</th>
                  <th style={{...th,textAlign:'right'}}>식비</th>
                  <th style={{...th,textAlign:'right'}}>기타</th>
                  <th style={th}>내용</th>
                  <th style={{...th,textAlign:'right'}}>합계</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.date} style={{ borderBottom:'1px solid #e5e7eb' }}>
                    <td style={td}>
                      <Link href={`/daily/${r.date}`}
                        style={{ color:'#2563eb', textDecoration:'none', fontWeight:'600' }}>
                        {r.date.slice(5).replace('-','/')}
                      </Link>
                    </td>
                    <td style={{...td,textAlign:'right'}}>{fmt(r.fuel_cost)}</td>
                    <td style={{...td,textAlign:'right'}}>{fmt(r.urea_cost)}</td>
                    <td style={{...td,textAlign:'right'}}>{fmt(r.meal_cost)}</td>
                    <td style={{...td,textAlign:'right'}}>{fmt(r.other_cost)}</td>
                    <td style={{...td,color:'#6b7280',fontSize:'12px'}}>{r.other_note||''}</td>
                    <td style={{...td,textAlign:'right',fontWeight:'700'}}>{rowTotal(r).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#eff6ff', fontWeight:'700' }}>
                  <td style={td}>합계</td>
                  <td style={{...td,textAlign:'right'}}>{summary.fuel_cost ? summary.fuel_cost.toLocaleString() : '-'}</td>
                  <td style={{...td,textAlign:'right'}}>{summary.urea_cost ? summary.urea_cost.toLocaleString() : '-'}</td>
                  <td style={{...td,textAlign:'right'}}>{summary.meal_cost ? summary.meal_cost.toLocaleString() : '-'}</td>
                  <td style={{...td,textAlign:'right'}}>{summary.other_cost ? summary.other_cost.toLocaleString() : '-'}</td>
                  <td style={td}></td>
                  <td style={{...td,textAlign:'right',color:'#1e40af'}}>{grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function StatsTab({ year, byMonth }) {
  const LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const totals = byMonth.map(rowTotal);
  const maxTotal = Math.max(...totals, 1);
  const yearTotal = totals.reduce((a,b) => a+b, 0);
  const yearFuel  = byMonth.reduce((a,r) => a+r.fuel_cost,  0);
  const yearUrea  = byMonth.reduce((a,r) => a+r.urea_cost,  0);
  const yearMeal  = byMonth.reduce((a,r) => a+r.meal_cost,  0);
  const yearOther = byMonth.reduce((a,r) => a+r.other_cost, 0);

  // SVG 막대 차트
  const W = 600, H = 200, PAD = { top:20, right:10, bottom:30, left:60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;
  const barW   = chartW / 12 * 0.6;
  const gap    = chartW / 12;

  return (
    <>
      {/* 연도 네비게이션 */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <Link href={`/expenses/${year-1}/${new Date().getMonth()+1}`} className="btn btn-outline btn-sm">◀ {year-1}년</Link>
        <span style={{ fontWeight:'700', fontSize:'18px' }}>{year}년 연간 통계</span>
        <Link href={`/expenses/${year+1}/${new Date().getMonth()+1}`} className="btn btn-outline btn-sm">{year+1}년 ▶</Link>
      </div>

      {/* 연간 합계 요약 */}
      <div className="card" style={{ marginBottom:'20px' }}>
        <h2>연간 합계</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'12px', marginTop:'14px' }}>
          {[['주유비',yearFuel,'#3b82f6'],['요소수',yearUrea,'#10b981'],['식비',yearMeal,'#f59e0b'],['기타',yearOther,'#8b5cf6'],['총합계',yearTotal,'#1e40af']].map(([label,val,color]) => (
            <div key={label} style={{ background:'#f8fafc', borderRadius:'8px', padding:'12px', borderLeft:`4px solid ${color}` }}>
              <div style={{ fontSize:'12px', color:'#6b7280', marginBottom:'4px' }}>{label}</div>
              <div style={{ fontWeight:'700', fontSize:'15px', color }}>{val ? val.toLocaleString()+'원' : '-'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 막대 차트 */}
      <div className="card" style={{ marginBottom:'20px' }}>
        <h2>월별 합계 추이</h2>
        <div style={{ overflowX:'auto', marginTop:'16px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:'400px', display:'block' }}>
            {/* Y축 눈금 */}
            {[0,0.25,0.5,0.75,1].map(ratio => {
              const y = PAD.top + chartH * (1 - ratio);
              const val = Math.round(maxTotal * ratio);
              return (
                <g key={ratio}>
                  <line x1={PAD.left} y1={y} x2={PAD.left+chartW} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  <text x={PAD.left-6} y={y+4} textAnchor="end" fontSize="10" fill="#9ca3af">
                    {val >= 10000 ? `${Math.round(val/10000)}만` : val.toLocaleString()}
                  </text>
                </g>
              );
            })}
            {/* 막대 + 라벨 */}
            {byMonth.map((r, i) => {
              const total = rowTotal(r);
              const barH  = total > 0 ? (total / maxTotal) * chartH : 0;
              const x     = PAD.left + gap * i + (gap - barW) / 2;
              const y     = PAD.top  + chartH - barH;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={barH} fill="#3b82f6" rx="3" opacity="0.85" />
                  {total > 0 && (
                    <text x={x+barW/2} y={y-4} textAnchor="middle" fontSize="9" fill="#374151">
                      {total >= 10000 ? `${Math.round(total/10000)}만` : total.toLocaleString()}
                    </text>
                  )}
                  <text x={x+barW/2} y={PAD.top+chartH+16} textAnchor="middle" fontSize="10" fill="#6b7280">
                    {LABELS[i]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 월별 비교표 */}
      <div className="card">
        <h2>월별 항목 비교</h2>
        <div style={{ overflowX:'auto', marginTop:'12px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
            <thead>
              <tr style={{ background:'#f1f5f9' }}>
                <th style={th}>월</th>
                <th style={{...th,textAlign:'right'}}>주유비</th>
                <th style={{...th,textAlign:'right'}}>요소수</th>
                <th style={{...th,textAlign:'right'}}>식비</th>
                <th style={{...th,textAlign:'right'}}>기타</th>
                <th style={{...th,textAlign:'right'}}>합계</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((r, i) => {
                const total = rowTotal(r);
                return (
                  <tr key={i} style={{ borderBottom:'1px solid #e5e7eb', background: total===0 ? '#fafafa' : 'white' }}>
                    <td style={{...td, fontWeight:'600', color: total===0 ? '#d1d5db' : '#111827'}}>
                      {LABELS[i]}
                    </td>
                    <td style={{...td,textAlign:'right',color:total===0?'#d1d5db':'inherit'}}>{r.fuel_cost  ? r.fuel_cost.toLocaleString()  : '-'}</td>
                    <td style={{...td,textAlign:'right',color:total===0?'#d1d5db':'inherit'}}>{r.urea_cost  ? r.urea_cost.toLocaleString()  : '-'}</td>
                    <td style={{...td,textAlign:'right',color:total===0?'#d1d5db':'inherit'}}>{r.meal_cost  ? r.meal_cost.toLocaleString()  : '-'}</td>
                    <td style={{...td,textAlign:'right',color:total===0?'#d1d5db':'inherit'}}>{r.other_cost ? r.other_cost.toLocaleString() : '-'}</td>
                    <td style={{...td,textAlign:'right',fontWeight:'700',color:total>0?'#1e40af':'#d1d5db'}}>{total ? total.toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#eff6ff', fontWeight:'700' }}>
                <td style={td}>연간 합계</td>
                <td style={{...td,textAlign:'right'}}>{yearFuel  ? yearFuel.toLocaleString()  : '-'}</td>
                <td style={{...td,textAlign:'right'}}>{yearUrea  ? yearUrea.toLocaleString()  : '-'}</td>
                <td style={{...td,textAlign:'right'}}>{yearMeal  ? yearMeal.toLocaleString()  : '-'}</td>
                <td style={{...td,textAlign:'right'}}>{yearOther ? yearOther.toLocaleString() : '-'}</td>
                <td style={{...td,textAlign:'right',color:'#1e40af'}}>{yearTotal ? yearTotal.toLocaleString() : '-'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

const th = { padding:'8px 12px', fontWeight:'600', fontSize:'13px', textAlign:'left', borderBottom:'2px solid #e5e7eb' };
const td = { padding:'8px 12px', fontSize:'13px' };
