import supabase from '../../../lib/supabase';

// 인쇄 전용 — Layout 없음
ReportPage.noLayout = true;

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
  const peDate = new Date(year, month, 0); // last day of month
  return { psDate, peDate };
}

function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function fmt(n, d = 3) {
  if (!n || n === 0) return '';
  return Number(n).toFixed(d);
}

export async function getServerSideProps({ params }) {
  const year  = parseInt(params.year);
  const month = parseInt(params.month);

  const [setRes, wRes] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('workers').select('*').eq('active', true).order('sort_order').order('id'),
  ]);
  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });

  const { psDate, peDate } = getPeriod(year, month, settings.period_start_day);
  const ps = psDate.toISOString().slice(0, 10);
  const pe = peDate.toISOString().slice(0, 10);

  const [recRes, attRes] = await Promise.all([
    supabase.from('records').select('*').gte('record_date', ps).lte('record_date', pe).order('record_date'),
    supabase.from('attendance').select('*').gte('record_date', ps).lte('record_date', pe),
  ]);

  const workers = wRes.data || [];
  const records = recRes.data || [];
  const recMap  = {};
  records.forEach(r => { recMap[r.record_date] = r; });

  const attMap = {};
  (attRes.data || []).forEach(a => { attMap[`${a.record_date}_${a.worker_id}`] = a.value; });

  const dates = dateRange(psDate, peDate);
  const lastDay = peDate.getDate();

  const totalW   = records.reduce((s,r) => s + (r.weight_1||0) + (r.weight_2||0) + (r.weight_3||0), 0);
  const total3l  = records.reduce((s,r) => s + (r.chip_3l||0), 0);
  const total5l  = records.reduce((s,r) => s + (r.chip_5l||0), 0);
  const total20l = records.reduce((s,r) => s + (r.chip_20l||0), 0);
  const total120l= records.reduce((s,r) => s + (r.chip_120l||0), 0);
  const unitPrice= parseFloat(settings.unit_price) || 0;
  const totalAmt = totalW * unitPrice;

  return {
    props: {
      year, month, ps, pe, lastDay,
      settings, workers, records, recMap, attMap, dates,
      totalW, total3l, total5l, total20l, total120l,
      unitPrice, totalAmt, workDays: records.length,
    },
  };
}

export default function ReportPage({
  year, month, ps, pe, lastDay, settings, workers, records, recMap, attMap, dates,
  totalW, total3l, total5l, total20l, total120l, unitPrice, totalAmt, workDays,
}) {
  const periodLabel = `${ps} ~ ${pe}`;
  const monthPad = String(month).padStart(2, '0');

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; font-size: 10pt; color: #000; background: #fff; }
        .print-btn { position: fixed; top: 16px; right: 16px; background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 100; }
        @media print { .print-btn,.no-print { display: none !important; } }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 12mm; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        /* landscape pages */
        .page-land { width: 297mm; min-height: 210mm; margin: 0 auto; padding: 12mm; page-break-after: always; }
        .page-land:last-child { page-break-after: auto; }
        @media print {
          .page { width: 210mm; }
          .page-land { width: 297mm; }
          @page { size: A4; margin: 0; }
          @page land { size: A4 landscape; }
        }

        h2.report-title { text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 4px; margin-bottom: 8mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }
        table.rt { width: 100%; border-collapse: collapse; font-size: 9pt; }
        table.rt th { background: #333; color: #fff; padding: 3px 4px; text-align: center; border: 1px solid #555; }
        table.rt td { border: 1px solid #ccc; padding: 3px 4px; text-align: center; }
        table.rt tfoot td { background: #f0f0f0; font-weight: bold; border: 1px solid #888; }
        table.rt td.r { text-align: right; }
        table.rt td.l { text-align: left; }
        .att-table { font-size: 7.5pt; }
        .att-table th, .att-table td { padding: 2px 3px; }
        .sun { color: #dc2626; }
        .invoice-banner { border: 2px solid #000; text-align: center; padding: 4mm; margin: 4mm 0; font-size: 13pt; }
        .inv-amount { font-size: 18pt; font-weight: bold; }
        .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 4mm 0; }
        .party-box { border: 1px solid #000; }
        .party-title { background: #e0e0e0; text-align: center; font-weight: bold; padding: 2mm; border-bottom: 1px solid #000; }
        .party-box table { width: 100%; border-collapse: collapse; }
        .party-box table td { border: 1px solid #aaa; padding: 2mm 3mm; font-size: 9pt; }
        .party-box table td:first-child { background: #f0f0f0; font-weight: bold; width: 30%; text-align: center; }
        .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8mm; }
        .sign-box { border: 1px solid #000; padding: 3mm 8mm; text-align: center; min-width: 55mm; }
        .sign-line { border-bottom: 1px solid #000; height: 14mm; margin: 2mm 0; }
        .period-box { border: 1px solid #000; padding: 3mm; font-size: 9.5pt; line-height: 1.9; }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>🖨 인쇄</button>

      {/* ──────────────────────────────────────────
          시트 1: 계근현황
      ────────────────────────────────────────── */}
      <div className="page">
        <h2 className="report-title">{monthPad}월 계근현황</h2>
        <p style={{textAlign:'right',fontSize:'9pt',marginBottom:'4mm'}}>기간: {periodLabel}</p>
        <table className="rt">
          <thead>
            <tr>
              <th rowSpan="2">월/일</th>
              <th colSpan="3">실중량 (톤)</th>
              <th rowSpan="2">계</th>
            </tr>
            <tr><th>1차</th><th>2차</th><th>3차</th></tr>
          </thead>
          <tbody>
            {dates.map(d => {
              const r = recMap[d];
              if (!r && !recMap[d]) {
                return (
                  <tr key={d}>
                    <td>{d.slice(5).replace('-','월 ')}일</td>
                    <td></td><td></td><td></td><td></td>
                  </tr>
                );
              }
              const wt = r ? (r.weight_1||0)+(r.weight_2||0)+(r.weight_3||0) : 0;
              return (
                <tr key={d}>
                  <td>{d.slice(5).replace('-','월 ')}일</td>
                  <td className="r">{fmt(r?.weight_1)}</td>
                  <td className="r">{fmt(r?.weight_2)}</td>
                  <td className="r">{fmt(r?.weight_3)}</td>
                  <td className="r" style={{fontWeight:'bold'}}>{r ? wt.toFixed(3) : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>합 계</td>
              <td colSpan="3"></td>
              <td className="r">{totalW.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ──────────────────────────────────────────
          시트 2: 칩 수거현황
      ────────────────────────────────────────── */}
      <div className="page">
        <h2 className="report-title">{monthPad}월 칩수거현황</h2>
        <p style={{textAlign:'right',fontSize:'9pt',marginBottom:'4mm'}}>기간: {periodLabel}</p>
        <table className="rt">
          <thead>
            <tr>
              <th rowSpan="2">일자</th>
              <th colSpan="2">3 ℓ</th>
              <th colSpan="2">5 ℓ</th>
              <th colSpan="2">20 ℓ</th>
              <th colSpan="2">120 ℓ</th>
              <th rowSpan="2">합계(ℓ)</th>
            </tr>
            <tr>
              <th>개</th><th>소계(ℓ)</th>
              <th>개</th><th>소계(ℓ)</th>
              <th>개</th><th>소계(ℓ)</th>
              <th>개</th><th>소계(ℓ)</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(d => {
              const r = recMap[d];
              if (!r) return (
                <tr key={d}><td>{d.slice(5).replace('-','월 ')}일</td><td colSpan="9"></td></tr>
              );
              const s3=r.chip_3l*3, s5=r.chip_5l*5, s20=r.chip_20l*20, s120=r.chip_120l*120;
              const tot=s3+s5+s20+s120;
              return (
                <tr key={d}>
                  <td>{d.slice(5).replace('-','월 ')}일</td>
                  <td className="r">{r.chip_3l||0}</td><td className="r">{s3.toLocaleString()}</td>
                  <td className="r">{r.chip_5l||0}</td><td className="r">{s5.toLocaleString()}</td>
                  <td className="r">{r.chip_20l||0}</td><td className="r">{s20.toLocaleString()}</td>
                  <td className="r">{r.chip_120l||0}</td><td className="r">{s120.toLocaleString()}</td>
                  <td className="r" style={{fontWeight:'bold'}}>{tot.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>합 계</td>
              <td className="r">{total3l}</td><td className="r">{(total3l*3).toLocaleString()}</td>
              <td className="r">{total5l}</td><td className="r">{(total5l*5).toLocaleString()}</td>
              <td className="r">{total20l}</td><td className="r">{(total20l*20).toLocaleString()}</td>
              <td className="r">{total120l}</td><td className="r">{(total120l*120).toLocaleString()}</td>
              <td className="r">{(total3l*3+total5l*5+total20l*20+total120l*120).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ──────────────────────────────────────────
          시트 3: 일일 근무현황
      ────────────────────────────────────────── */}
      <div className="page-land">
        <h2 className="report-title">■ {settings.company_name || '진우환경'} 일일 근무현황({monthPad}월)</h2>
        <div style={{overflowX:'auto'}}>
          <table className="rt att-table" style={{tableLayout:'fixed',width:'100%'}}>
            <thead>
              <tr>
                <th style={{width:'52px'}}>근 무 자</th>
                {dates.map(d => {
                  const dow = new Date(d).getDay();
                  const isSun = dow === 0;
                  return (
                    <th key={d} className={isSun ? 'sun' : ''} style={{width:'18px',fontSize:'7pt'}}>
                      {parseInt(d.slice(8))}
                    </th>
                  );
                })}
                <th style={{width:'30px'}}>합 계</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => {
                const total = dates.reduce((s, d) => {
                  const v = attMap[`${d}_${w.id}`];
                  return s + (v !== undefined ? v : 0);
                }, 0);
                return (
                  <tr key={w.id}>
                    <td className="l" style={{fontWeight:'bold',paddingLeft:'3px'}}>{w.name}</td>
                    {dates.map(d => {
                      const v = attMap[`${d}_${w.id}`];
                      const dow = new Date(d).getDay();
                      return (
                        <td key={d} className={dow===0?'sun':''} style={{fontSize:'7.5pt'}}>
                          {v !== undefined && v !== 0 ? v : ''}
                        </td>
                      );
                    })}
                    <td style={{fontWeight:'bold'}}>{total}</td>
                  </tr>
                );
              })}
              {/* 일 근무인원 합계 행 */}
              <tr style={{borderTop:'2px solid #000'}}>
                <td className="l" style={{fontWeight:'bold',fontSize:'7.5pt',paddingLeft:'2px'}}>일 근무인원</td>
                {dates.map(d => {
                  const dayTotal = workers.reduce((s, w) => {
                    const v = attMap[`${d}_${w.id}`];
                    return s + (v !== undefined ? parseFloat(v) : 0);
                  }, 0);
                  return (
                    <td key={d} style={{fontWeight:'bold',fontSize:'7.5pt'}}>
                      {dayTotal > 0 ? dayTotal : ''}
                    </td>
                  );
                })}
                <td style={{fontWeight:'bold'}}>
                  {workers.reduce((s, w) =>
                    s + dates.reduce((ss, d) => {
                      const v = attMap[`${d}_${w.id}`];
                      return ss + (v !== undefined ? parseFloat(v) : 0);
                    }, 0), 0
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────
          시트 4: 청구서
      ────────────────────────────────────────── */}
      <div className="page">
        <h2 className="report-title">청 구 서</h2>

        <div className="invoice-banner">
          아래와 같이 청구합니다.<br />
          청구금액 : <span className="inv-amount">₩ {Math.round(totalAmt).toLocaleString()}</span>
        </div>

        {settings.contract_number && (
          <div style={{border:'1px solid #000',padding:'3mm 4mm',marginBottom:'3mm',fontSize:'10pt'}}>
            <strong>계약번호:</strong> {settings.contract_number}
            {settings.contract_start && settings.contract_end && (
              <span style={{marginLeft:'12mm'}}>
                <strong>계약기간:</strong> {settings.contract_start} ~ {settings.contract_end}
              </span>
            )}
          </div>
        )}

        <div className="party-grid">
          <div className="party-box">
            <div className="party-title">공급받는자 (발주처)</div>
            <table>
              <tbody>
                <tr><td>상호</td><td>{settings.client_name}</td></tr>
                <tr><td>이행기간</td><td>{periodLabel}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="party-box">
            <div className="party-title">공급자 (청구인)</div>
            <table>
              <tbody>
                <tr><td>상호</td><td>{settings.company_name}</td></tr>
                <tr><td>사업자번호</td><td>{settings.company_reg}</td></tr>
                <tr><td>주소</td><td>{settings.company_addr}</td></tr>
                <tr><td>전화</td><td>{settings.company_tel}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <table className="rt" style={{marginBottom:'4mm'}}>
          <thead>
            <tr>
              <th>품목</th><th>이행기간</th><th>근무일수</th>
              <th>총 수거량</th><th>단가(원/톤)</th><th>금액(원)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>음식물쓰레기 수집·운반</td>
              <td>{periodLabel}</td>
              <td>{workDays}일</td>
              <td className="r">{totalW.toFixed(3)} 톤</td>
              <td className="r">{unitPrice.toLocaleString()}</td>
              <td className="r" style={{fontWeight:'bold'}}>{Math.round(totalAmt).toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="5" style={{textAlign:'center'}}>합 계</td>
              <td className="r">{Math.round(totalAmt).toLocaleString()} 원</td>
            </tr>
          </tfoot>
        </table>

        <table className="rt" style={{marginBottom:'4mm'}}>
          <thead>
            <tr>
              <th>3L (개)</th><th>5L (개)</th><th>20L (개)</th><th>120L (개)</th><th>합계 (ℓ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{total3l}</td><td>{total5l}</td><td>{total20l}</td><td>{total120l}</td>
              <td style={{fontWeight:'bold'}}>{(total3l*3+total5l*5+total20l*20+total120l*120).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div className="sign-row">
          <div className="period-box">
            <strong>청구일자</strong> : {year}년 {month}월 말일<br />
            <strong>이행기간</strong> : {periodLabel}<br />
            <strong>근무일수</strong> : {workDays}일<br />
            <strong>총수거량</strong> : {totalW.toFixed(3)} 톤
          </div>
          <div className="sign-box">
            <div style={{fontWeight:'bold',fontSize:'12pt',marginBottom:'2mm'}}>{settings.company_name}</div>
            <div className="sign-line"></div>
            <div style={{fontSize:'9pt',color:'#555'}}>대표자 (인)</div>
          </div>
        </div>

        {/* 근무 확인서 */}
        <div style={{marginTop:'12mm',borderTop:'2px solid #000',paddingTop:'6mm'}}>
          <div style={{fontWeight:'bold',marginBottom:'4mm'}}>■ 근무 확인서 {monthPad}월({settings.area || ''})</div>
          <table className="rt">
            <thead>
              <tr><th>성명</th><th>직위</th><th>생년월일</th><th>비 고</th></tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id}>
                  <td style={{fontWeight:'bold'}}>{w.name}</td>
                  <td>{w.position}</td>
                  <td>{w.dob}</td>
                  <td></td>
                </tr>
              ))}
              {Array.from({length: Math.max(0, 4 - workers.length)}).map((_,i) => (
                <tr key={`empty-${i}`}><td>&nbsp;</td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
