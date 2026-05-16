import supabase from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

ReportPrintPage.noLayout = true;

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
  if (n == null || n === '' || Number(n) === 0) return '';
  return Number(n).toFixed(d);
}

function toKorean(n) {
  if (!n || n === 0) return '영원정';
  const ones = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  function group4(g) {
    let s = '';
    const ch  = Math.floor(g / 1000);
    const bek = Math.floor((g % 1000) / 100);
    const sip = Math.floor((g % 100) / 10);
    const il  = g % 10;
    if (ch  > 0) s += (ch  === 1 ? '' : ones[ch])  + '천';
    if (bek > 0) s += (bek === 1 ? '' : ones[bek]) + '백';
    if (sip > 0) s += (sip === 1 ? '' : ones[sip]) + '십';
    if (il  > 0) s += ones[il];
    return s;
  }
  const num  = Math.abs(Math.floor(n));
  const eok  = Math.floor(num / 100000000);
  const man  = Math.floor((num % 100000000) / 10000);
  const rest = num % 10000;
  let result = '';
  if (eok  > 0) result += group4(eok)  + '억';
  if (man  > 0) result += group4(man)  + '만';
  if (rest > 0) result += group4(rest);
  return result + '원정';
}

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const type = params.type;
  if (!['work', 'billing', 'all'].includes(type)) {
    return { notFound: true };
  }

  const year       = parseInt(params.year);
  const month      = parseInt(params.month);
  const contractId = query.contract ? parseInt(query.contract) : null;
  const sdParam    = query.sd ? parseInt(query.sd) : null;

  const [setRes, wRes, contRes] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('workers').select('*').eq('active', true).order('sort_order').order('id'),
    contractId
      ? supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
      : supabase.from('contracts').select('*').eq('active', true).order('sort_order').order('id').limit(1),
  ]);
  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });

  // contract: single object or first from list
  const contract = contractId
    ? (contRes.data || null)
    : (Array.isArray(contRes.data) ? contRes.data[0] : contRes.data) || null;

  const startDay = sdParam ?? parseInt(settings.period_start_day) ?? 1;
  const { psDate, peDate } = getPeriod(year, month, startDay);
  const ps = psDate.toISOString().slice(0, 10);
  const pe = peDate.toISOString().slice(0, 10);

  let recQ = supabase.from('records').select('*').gte('record_date', ps).lte('record_date', pe).order('record_date');
  let attQ = supabase.from('attendance').select('*').gte('record_date', ps).lte('record_date', pe);
  if (contractId) {
    recQ = recQ.eq('contract_id', contractId);
    attQ = attQ.eq('contract_id', contractId);
  }

  const [recRes, attRes] = await Promise.all([recQ, attQ]);

  const workers = wRes.data || [];
  const records = recRes.data || [];
  const recMap  = {};
  records.forEach(r => { recMap[r.record_date] = r; });

  const attMap = {};
  (attRes.data || []).forEach(a => { attMap[`${a.record_date}_${a.worker_id}`] = a.value; });

  const dates = dateRange(psDate, peDate);

  const totalW    = records.reduce((s, r) => s + (parseFloat(r.weight_1) || 0) + (parseFloat(r.weight_2) || 0) + (parseFloat(r.weight_3) || 0), 0);
  const total3l   = records.reduce((s, r) => s + (parseInt(r.chip_3l)   || 0), 0);
  const total5l   = records.reduce((s, r) => s + (parseInt(r.chip_5l)   || 0), 0);
  const total20l  = records.reduce((s, r) => s + (parseInt(r.chip_20l)  || 0), 0);
  const total120l = records.reduce((s, r) => s + (parseInt(r.chip_120l) || 0), 0);
  const unitPrice  = parseFloat(contract?.unit_price) || parseFloat(settings.unit_price) || 0;
  const billingAmt = Math.floor(totalW * unitPrice / 1000) * 1000;
  const totalSalary = workers.reduce((s, w) => s + (parseInt(w.monthly_salary) || 0), 0);
  const peLastDay = peDate.getDate();

  return {
    props: {
      type,
      year, month, ps, pe, peLastDay,
      settings, contract: contract || {}, workers, records, recMap, attMap, dates,
      totalW, total3l, total5l, total20l, total120l,
      unitPrice, billingAmt, workDays: records.length, totalSalary,
    },
  };
}

export default function ReportPrintPage({
  type,
  year, month, ps, pe, peLastDay,
  settings, contract, workers, records, recMap, attMap, dates,
  totalW, total3l, total5l, total20l, total120l,
  unitPrice, billingAmt, workDays, totalSalary,
}) {
  const monthPad    = String(month).padStart(2, '0');
  const periodLabel = `${ps} ~ ${pe}`;
  const salaryDay   = parseInt(settings.salary_payment_day) || 16;
  const contractAmt = parseInt(contract?.amount) || 0;

  // 계약 정보는 contract 우선, 없으면 settings fallback
  const contractName   = contract?.name               || settings.contract_name        || '';
  const contractNumber = contract?.number             || settings.contract_number      || '';
  const contractStart  = contract?.contract_start     || settings.contract_start       || '';
  const contractEnd    = contract?.contract_end       || settings.contract_end         || '';
  const constStart     = contract?.construction_start || settings.construction_start   || '';
  const clientName     = contract?.client_name        || settings.client_name          || '';
  const recipient1     = contract?.client_recipient_1 || settings.client_recipient_1   || '';
  const recipient2     = contract?.client_recipient_2 || settings.client_recipient_2   || '';
  const area           = contract?.area               || settings.area                 || '';

  const showWork    = type === 'work'    || type === 'all';
  const showBilling = type === 'billing' || type === 'all';

  const typeLabel = type === 'work' ? '근무현황 보고서' : type === 'billing' ? '기성/청구 서류' : '전체 보고서';

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; font-size: 10pt; color: #000; }
    .print-btn { position: fixed; top: 16px; right: 16px; background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .back-btn { position: fixed; top: 16px; left: 16px; background: #fff; color: #374151; border: 1px solid #d1d5db; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    @media print { .back-btn { display: none !important; } }

    @media screen {
      body { background: #6b7280; padding: 20px 0; }
      .page, .page-land {
        background: #fff;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        margin-bottom: 24px !important;
      }
      .page-label {
        display: block;
        text-align: center;
        color: #e5e7eb;
        font-size: 11px;
        font-family: sans-serif;
        margin-bottom: 4px;
        letter-spacing: 1px;
      }
    }
    @media print {
      body { background: #fff; }
      .print-btn { display: none !important; }
      .page-label { display: none !important; }
      @page { size: A4; margin: 0; }
    }

    .page {
      width: 210mm; min-height: 297mm;
      margin: 0 auto; padding: 15mm 14mm;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }

    .page-land {
      width: 297mm; min-height: 210mm;
      margin: 0 auto; padding: 12mm 10mm;
      page-break-after: always;
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

    .doc-title { text-align: center; font-size: 20pt; font-weight: bold; letter-spacing: 10px; margin-bottom: 10mm; }
    .doc-list { margin: 2mm 0 4mm 0; list-style: none; }
    .doc-list li { line-height: 2.4; font-size: 10.5pt; }
    .doc-list li .lbl { display: inline-block; min-width: 42mm; font-weight: bold; }
    .doc-center { text-align: center; font-weight: bold; font-size: 12pt; margin: 5mm 0; }
    .doc-body { text-align: center; font-size: 10.5pt; margin: 4mm 0; }
    .doc-sub { font-size: 10pt; margin: 2mm 0 1mm; font-weight: bold; }

    .doc-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 3mm 0; }
    .doc-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; background: #e8e8e8; font-weight: bold; }
    .doc-table td { border: 1px solid #000; padding: 4px 6px; }
    .doc-table td.r { text-align: right; }
    .doc-table td.c { text-align: center; }
    .doc-table tfoot td { border: 1px solid #000; padding: 4px 6px; font-weight: bold; background: #f0f0f0; text-align: center; }
    .doc-table tfoot td.r { text-align: right; }

    .amount-box { border: 1px solid #000; padding: 3mm 5mm; margin: 4mm 0; font-size: 10pt; line-height: 2; }
    .sign-block { margin-top: 12mm; text-align: right; font-size: 10.5pt; line-height: 2.4; }
    .sign-block .company { font-size: 12pt; font-weight: bold; }
    .sign-block .ceo { font-size: 10.5pt; }

    .gi-meta { border: 1px solid #000; padding: 3mm 4mm; margin-bottom: 5mm; }
    .gi-meta table { width: 100%; border-collapse: collapse; }
    .gi-meta td { padding: 3px 6px; border-bottom: 1px solid #ddd; font-size: 9.5pt; }
    .gi-meta td:first-child { font-weight: bold; width: 28%; background: #f5f5f5; }
    .gi-meta tr:last-child td { border-bottom: none; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <button className="print-btn" onClick={() => window.print()}>🖨 인쇄</button>
      <button className="back-btn" onClick={() => window.history.back()}>← 뒤로</button>

      {/* ══ 근무현황 그룹 ══ */}
      {showWork && (
        <>
          {/* 시트 1: 계근현황 */}
          <span className="page-label">▌ 계근현황</span>
          <div className="page">
            <h2 className="report-title">{monthPad}월 계근현황</h2>
            <p style={{textAlign:'right',fontSize:'9pt',marginBottom:'4mm'}}>기간: {periodLabel}</p>
            <table className="rt">
              <thead>
                <tr>
                  <th rowSpan="2">월 / 일</th>
                  <th colSpan="3">실중량 (톤)</th>
                  <th rowSpan="2">계 (톤)</th>
                </tr>
                <tr><th>1차</th><th>2차</th><th>3차</th></tr>
              </thead>
              <tbody>
                {dates.map(d => {
                  const r = recMap[d];
                  const wt = r
                    ? (parseFloat(r.weight_1)||0) + (parseFloat(r.weight_2)||0) + (parseFloat(r.weight_3)||0)
                    : 0;
                  return (
                    <tr key={d}>
                      <td>{d.slice(5).replace('-', '월 ')}일</td>
                      <td className="r">{r ? fmt(r.weight_1) : ''}</td>
                      <td className="r">{r ? fmt(r.weight_2) : ''}</td>
                      <td className="r">{r ? fmt(r.weight_3) : ''}</td>
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

          {/* 시트 2: 칩수거현황 */}
          <span className="page-label">▌ 칩수거현황</span>
          <div className="page">
            <h2 className="report-title">{monthPad}월 칩수거현황</h2>
            <p style={{textAlign:'right',fontSize:'9pt',marginBottom:'4mm'}}>기간: {periodLabel}</p>
            <table className="rt">
              <thead>
                <tr>
                  <th rowSpan="2">일 자</th>
                  <th colSpan="2">3 ℓ</th>
                  <th colSpan="2">5 ℓ</th>
                  <th colSpan="2">20 ℓ</th>
                  <th colSpan="2">120 ℓ</th>
                  <th rowSpan="2">합계 (ℓ)</th>
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
                    <tr key={d}>
                      <td>{d.slice(5).replace('-', '월 ')}일</td>
                      <td colSpan="9"></td>
                    </tr>
                  );
                  const s3 = (r.chip_3l||0)*3, s5 = (r.chip_5l||0)*5;
                  const s20 = (r.chip_20l||0)*20, s120 = (r.chip_120l||0)*120;
                  return (
                    <tr key={d}>
                      <td>{d.slice(5).replace('-', '월 ')}일</td>
                      <td className="r">{r.chip_3l||0}</td>  <td className="r">{s3.toLocaleString()}</td>
                      <td className="r">{r.chip_5l||0}</td>  <td className="r">{s5.toLocaleString()}</td>
                      <td className="r">{r.chip_20l||0}</td> <td className="r">{s20.toLocaleString()}</td>
                      <td className="r">{r.chip_120l||0}</td><td className="r">{s120.toLocaleString()}</td>
                      <td className="r" style={{fontWeight:'bold'}}>{(s3+s5+s20+s120).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>합 계</td>
                  <td className="r">{total3l}</td>  <td className="r">{(total3l*3).toLocaleString()}</td>
                  <td className="r">{total5l}</td>  <td className="r">{(total5l*5).toLocaleString()}</td>
                  <td className="r">{total20l}</td> <td className="r">{(total20l*20).toLocaleString()}</td>
                  <td className="r">{total120l}</td><td className="r">{(total120l*120).toLocaleString()}</td>
                  <td className="r">{(total3l*3+total5l*5+total20l*20+total120l*120).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 시트 3: 일일 근무현황 (가로) */}
          <span className="page-label">▌ 일일 근무현황</span>
          <div className="page-land">
            <h2 className="report-title">■ {settings.company_name || '진우환경'} 일일 근무현황 ({monthPad}월)</h2>
            <div style={{overflowX:'auto'}}>
              <table className="rt att-table" style={{tableLayout:'fixed',width:'100%'}}>
                <thead>
                  <tr>
                    <th style={{width:'52px'}}>근 무 자</th>
                    {dates.map(d => {
                      const dow = new Date(d).getDay();
                      return (
                        <th key={d} className={dow===0?'sun':''} style={{width:'18px',fontSize:'7pt'}}>
                          {parseInt(d.slice(8))}
                        </th>
                      );
                    })}
                    <th style={{width:'32px'}}>합 계</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map(w => {
                    const total = dates.reduce((s, d) => {
                      const v = attMap[`${d}_${w.id}`];
                      return s + (v !== undefined ? parseFloat(v) : 0);
                    }, 0);
                    return (
                      <tr key={w.id}>
                        <td className="l" style={{fontWeight:'bold',paddingLeft:'3px'}}>{w.name}</td>
                        {dates.map(d => {
                          const v = attMap[`${d}_${w.id}`];
                          const dow = new Date(d).getDay();
                          return (
                            <td key={d} className={dow===0?'sun':''} style={{fontSize:'7.5pt'}}>
                              {v !== undefined && parseFloat(v) !== 0 ? v : ''}
                            </td>
                          );
                        })}
                        <td style={{fontWeight:'bold'}}>{total}</td>
                      </tr>
                    );
                  })}
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
        </>
      )}

      {/* ══ 기성/청구 그룹 ══ */}
      {showBilling && (
        <>
          {/* 시트 4: 대금청구서 */}
          <span className="page-label">▌ 대금청구서</span>
          <div className="page">
            <div style={{textAlign:'right',fontSize:'9pt',marginBottom:'6mm'}}>
              {year}년 {monthPad}월분
            </div>
            <div className="doc-title">대 금 청 구 서</div>
            <ul className="doc-list">
              <li><span className="lbl">수　　　신 :</span> {recipient1 || clientName}</li>
              <li><span className="lbl">발　　　신 :</span> {settings.company_name} 대표이사 {settings.ceo_name}</li>
              <li><span className="lbl">제　　　목 :</span> {contractName} 대금청구</li>
            </ul>
            <div className="doc-body" style={{marginTop:'6mm'}}>
              {contractName}에 관하여 아래와 같이 청구합니다.
            </div>
            <div className="doc-center">- 아　　래 -</div>
            <ul className="doc-list">
              <li><span className="lbl">1. 계 약 건 명 :</span> {contractName}</li>
              <li><span className="lbl">2. 계 약 번 호 :</span> {contractNumber}</li>
              <li><span className="lbl">3. 계 약 금 액 :</span> 금 {contractAmt.toLocaleString()}원 ({toKorean(contractAmt)})</li>
              <li><span className="lbl">4. 이 행 기 간 :</span> {periodLabel}</li>
              <li><span className="lbl">5. 청 구 금 액 :</span> 금 {billingAmt.toLocaleString()}원 ({toKorean(billingAmt)})</li>
            </ul>
            <div className="doc-sub" style={{marginTop:'5mm'}}>6. 청 구 내 역</div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>품　　명</th><th>단위</th><th>수량</th>
                  <th>단가 (원/톤)</th><th>금액 (원)</th><th>비 고</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>음식물류폐기물 수집·운반</td>
                  <td className="c">톤</td>
                  <td className="r">{totalW.toFixed(3)}</td>
                  <td className="r">{unitPrice.toLocaleString()}</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                  <td className="c">{periodLabel}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4">합　　계</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <ul className="doc-list" style={{marginTop:'4mm'}}>
              <li>
                <span className="lbl">7. 입 금 계 좌 :</span>
                {settings.bank_name} {settings.bank_account}
                {settings.bank_type ? ` (${settings.bank_type})` : ''}
                &nbsp; 예금주: {settings.company_name}
              </li>
            </ul>
            <div className="sign-block">
              <div>{year}년 {month}월 {peLastDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>

          {/* 시트 5: 기성부분검사원 */}
          <span className="page-label">▌ 기성부분검사원</span>
          <div className="page">
            <div style={{textAlign:'right',fontSize:'9pt',marginBottom:'6mm'}}>
              {year}년 {monthPad}월분
            </div>
            <div className="doc-title">기성부분검사원</div>
            <ul className="doc-list">
              <li><span className="lbl">수　　　신 :</span> {recipient2 || clientName}</li>
              <li><span className="lbl">발　　　신 :</span> {settings.company_name} 대표이사 {settings.ceo_name}</li>
              <li><span className="lbl">제　　　목 :</span> {contractName} 기성부분 검사 요청</li>
            </ul>
            <div className="doc-body" style={{marginTop:'6mm'}}>
              위 계약에 의한 기성부분을 아래와 같이 검사하여 주시기 바랍니다.
            </div>
            <div className="doc-center">- 아　　래 -</div>
            <ul className="doc-list">
              <li><span className="lbl">1. 계 약 건 명 :</span> {contractName}</li>
              <li><span className="lbl">2. 계 약 번 호 :</span> {contractNumber}</li>
              <li><span className="lbl">3. 계 약 금 액 :</span> 금 {contractAmt.toLocaleString()}원</li>
              <li><span className="lbl">4. 기 성 기 간 :</span> {periodLabel}</li>
              <li><span className="lbl">5. 기 성 금 액 :</span> 금 {billingAmt.toLocaleString()}원 ({toKorean(billingAmt)})</li>
              <li><span className="lbl">6. 착 공 일 자 :</span> {constStart}</li>
              <li><span className="lbl">7. 기 성 일 자 :</span> {pe}</li>
            </ul>
            <div className="doc-sub" style={{marginTop:'5mm'}}>8. 기 성 내 역</div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>품　　명</th><th>단위</th><th>수량</th>
                  <th>단가 (원/톤)</th><th>기성금액 (원)</th><th>비 고</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>음식물류폐기물 수집·운반</td>
                  <td className="c">톤</td>
                  <td className="r">{totalW.toFixed(3)}</td>
                  <td className="r">{unitPrice.toLocaleString()}</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                  <td className="c">{periodLabel}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4">합　　계</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="sign-block">
              <div>{year}년 {month}월 {peLastDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>

          {/* 시트 6: 기성계 */}
          <span className="page-label">▌ 기성계</span>
          <div className="page">
            <div className="doc-title">기　성　계</div>
            <div className="gi-meta">
              <table>
                <tbody>
                  <tr>
                    <td>계 약 건 명</td>
                    <td colSpan="3" style={{fontWeight:'normal'}}>{contractName}</td>
                  </tr>
                  <tr>
                    <td>계 약 번 호</td>
                    <td style={{fontWeight:'normal'}}>{contractNumber}</td>
                    <td>계 약 금 액</td>
                    <td style={{fontWeight:'normal',textAlign:'right'}}>{contractAmt.toLocaleString()} 원</td>
                  </tr>
                  <tr>
                    <td>계 약 기 간</td>
                    <td style={{fontWeight:'normal'}}>{contractStart} ~ {contractEnd}</td>
                    <td>기 성 기 간</td>
                    <td style={{fontWeight:'normal'}}>{periodLabel}</td>
                  </tr>
                  <tr>
                    <td>공 급 자</td>
                    <td style={{fontWeight:'normal'}}>{settings.company_name} 대표이사 {settings.ceo_name}</td>
                    <td>사 업 자 번 호</td>
                    <td style={{fontWeight:'normal'}}>{settings.company_reg}</td>
                  </tr>
                  <tr>
                    <td>주　　소</td>
                    <td colSpan="3" style={{fontWeight:'normal'}}>{settings.company_addr}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th rowSpan="2">품　　명</th>
                  <th rowSpan="2">단위</th>
                  <th colSpan="3">계　약　내　역</th>
                  <th colSpan="3">기　성　내　역</th>
                </tr>
                <tr>
                  <th>수량</th><th>단가 (원)</th><th>계약금액 (원)</th>
                  <th>수량</th><th>단가 (원)</th><th>기성금액 (원)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>음식물류폐기물 수집·운반</td>
                  <td className="c">톤</td>
                  <td className="c">-</td>
                  <td className="r">{unitPrice.toLocaleString()}</td>
                  <td className="r">{contractAmt.toLocaleString()}</td>
                  <td className="r">{totalW.toFixed(3)}</td>
                  <td className="r">{unitPrice.toLocaleString()}</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4">합　　계</td>
                  <td className="r">{contractAmt.toLocaleString()}</td>
                  <td colSpan="2"></td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            <div className="amount-box" style={{marginTop:'6mm'}}>
              <div>기성금액 합계 : 금 <strong>{billingAmt.toLocaleString()}</strong>원</div>
              <div>한 글 금 액 : 금 <strong>{toKorean(billingAmt)}</strong></div>
            </div>
            <div className="sign-block">
              <div>{year}년 {month}월 {peLastDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>

          {/* 시트 7: 노무비청구내역서 */}
          <span className="page-label">▌ 노무비청구내역서</span>
          <div className="page">
            <div style={{textAlign:'right',fontSize:'9pt',marginBottom:'6mm'}}>
              {year}년 {monthPad}월분
            </div>
            <div className="doc-title">노무비 청구 내역서</div>
            <ul className="doc-list">
              <li><span className="lbl">수　　　신 :</span> {recipient1 || clientName}</li>
              <li><span className="lbl">발　　　신 :</span> {settings.company_name} 대표이사 {settings.ceo_name}</li>
              <li><span className="lbl">제　　　목 :</span> {contractName} 노무비 청구</li>
            </ul>
            <div className="doc-body" style={{marginTop:'6mm'}}>
              위 계약에 의한 노무비를 아래와 같이 청구합니다.
            </div>
            <div className="doc-center">- 아　　래 -</div>
            <ul className="doc-list">
              <li><span className="lbl">1. 계 약 건 명 :</span> {contractName}</li>
              <li><span className="lbl">2. 이 행 기 간 :</span> {periodLabel}</li>
              <li><span className="lbl">3. 지 급 일 자 :</span> {year}년 {month}월 {salaryDay}일</li>
              <li><span className="lbl">4. 청 구 금 액 :</span> 금 {totalSalary.toLocaleString()}원 ({toKorean(totalSalary)})</li>
            </ul>
            <div className="doc-sub" style={{marginTop:'5mm'}}>5. 노 무 비 내 역</div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>연번</th>
                  <th>성　명</th>
                  <th>직위 / 직종</th>
                  <th>지급금액 (원)</th>
                  <th>비　고</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.id}>
                    <td className="c">{i + 1}</td>
                    <td className="c" style={{fontWeight:'bold'}}>{w.name}</td>
                    <td className="c">{w.position}</td>
                    <td className="r">{(parseInt(w.monthly_salary) || 0).toLocaleString()}</td>
                    <td></td>
                  </tr>
                ))}
                {Array.from({length: Math.max(0, 5 - workers.length)}).map((_, i) => (
                  <tr key={`emp-${i}`}><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">합　　계</td>
                  <td className="r">{totalSalary.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="amount-box" style={{marginTop:'5mm'}}>
              <div>노무비 합계 : 금 <strong>{totalSalary.toLocaleString()}</strong>원</div>
              <div>한 글 금 액 : 금 <strong>{toKorean(totalSalary)}</strong></div>
            </div>
            <div className="sign-block">
              <div>{year}년 {month}월 {peLastDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>

          {/* 시트 8: 노무비지급내역서 */}
          <span className="page-label">▌ 노무비지급내역서</span>
          <div className="page">
            <div className="doc-title" style={{letterSpacing:'6px'}}>노무비 지급 내역서</div>
            <div style={{textAlign:'center',fontSize:'10pt',marginBottom:'8mm'}}>[ 서 식 3 ]</div>
            <div style={{display:'flex',gap:'10mm',marginBottom:'5mm',fontSize:'9.5pt',flexWrap:'wrap'}}>
              <span><strong>귀 사 명 :</strong> {settings.company_name || ''}</span>
              <span><strong>지 급 월 :</strong> {year}년 {monthPad}월분</span>
              <span><strong>지 급 일 :</strong> {year}년 {month}월 {salaryDay}일</span>
            </div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>연번</th>
                  <th>성　명</th>
                  <th>직위 / 직종</th>
                  <th>지급금액 (원)</th>
                  <th>은 행 명</th>
                  <th>계 좌 번 호</th>
                  <th>전화번호</th>
                  <th>비 고</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.id}>
                    <td className="c">{i + 1}</td>
                    <td className="c" style={{fontWeight:'bold'}}>{w.name}</td>
                    <td className="c">{w.position}</td>
                    <td className="r">{(parseInt(w.monthly_salary) || 0).toLocaleString()}</td>
                    <td className="c">{w.bank_name || ''}</td>
                    <td className="c">{w.bank_account || ''}</td>
                    <td className="c">{w.phone || ''}</td>
                    <td></td>
                  </tr>
                ))}
                {Array.from({length: Math.max(0, 5 - workers.length)}).map((_, i) => (
                  <tr key={`emp-${i}`}><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">합　　계</td>
                  <td className="r">{totalSalary.toLocaleString()}</td>
                  <td colSpan="4"></td>
                </tr>
              </tfoot>
            </table>
            <div className="amount-box" style={{marginTop:'5mm'}}>
              <div>지급합계 : 금 <strong>{totalSalary.toLocaleString()}</strong>원 ({toKorean(totalSalary)})</div>
            </div>
            <div className="sign-block">
              <div>{year}년 {month}월 {salaryDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>
        </>
      )}

      {/* ══ 근무확인서 (근무현황 그룹 마지막) ══ */}
      {showWork && (
        <>
          <span className="page-label">▌ 근무확인서</span>
          <div className="page">
            <h2 className="report-title">근 무 확 인 서</h2>
            <div style={{textAlign:'right',fontSize:'9pt',marginBottom:'5mm'}}>
              {monthPad}월 ({area}) &nbsp; 이행기간: {periodLabel}
            </div>
            <table className="rt">
              <thead>
                <tr>
                  <th>성 명</th>
                  <th>직 위</th>
                  <th>생년월일</th>
                  <th>비　고</th>
                </tr>
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
                {Array.from({length: Math.max(0, 4 - workers.length)}).map((_, i) => (
                  <tr key={`emp-${i}`}><td>&nbsp;</td><td></td><td></td><td></td></tr>
                ))}
              </tbody>
            </table>
            <div style={{marginTop:'10mm',fontSize:'10.5pt',lineHeight:'2.2'}}>
              위와 같이 근무하였음을 확인합니다.
            </div>
            <div className="sign-block">
              <div>{year}년 {month}월 {peLastDay}일</div>
              <div className="company">{settings.company_name}</div>
              <div className="ceo">대표이사　{settings.ceo_name}　(인)</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
