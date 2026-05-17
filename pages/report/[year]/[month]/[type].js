import supabase from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

ReportPrintPage.noLayout = true;

function getPeriod(year, month, startDay) {
  const sd = parseInt(startDay) || 1;
  const pad = n => String(n).padStart(2, '0');
  let ps;
  if (sd <= 1) {
    ps = `${year}-${pad(month)}-01`;
  } else {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    ps = `${py}-${pad(pm)}-${pad(sd)}`;
  }
  const lastDay = new Date(year, month, 0).getDate();
  const pe = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { ps, pe };
}

function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
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
  const sheetParam = query.sheet ? parseInt(query.sheet) : null;

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
  const { ps, pe } = getPeriod(year, month, startDay);

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

  const dates = dateRange(ps, pe);

  const totalW    = records.reduce((s, r) => s + (parseFloat(r.weight_1) || 0) + (parseFloat(r.weight_2) || 0) + (parseFloat(r.weight_3) || 0), 0);
  const total3l   = records.reduce((s, r) => s + (parseInt(r.chip_3l)   || 0), 0);
  const total5l   = records.reduce((s, r) => s + (parseInt(r.chip_5l)   || 0), 0);
  const total20l  = records.reduce((s, r) => s + (parseInt(r.chip_20l)  || 0), 0);
  const total120l = records.reduce((s, r) => s + (parseInt(r.chip_120l) || 0), 0);
  const unitPrice  = parseFloat(contract?.unit_price) || parseFloat(settings.unit_price) || 0;
  const billingAmt = Math.floor(totalW * unitPrice / 1000) * 1000;
  const totalSalary = workers.reduce((s, w) => s + (parseInt(w.monthly_salary) || 0), 0);
  const peLastDay = parseInt(pe.slice(8, 10));

  return {
    props: {
      type, sheet: sheetParam,
      contractId: contractId || null, startDay,
      year, month, ps, pe, peLastDay,
      settings, contract: contract || {}, workers, records, recMap, attMap, dates,
      totalW, total3l, total5l, total20l, total120l,
      unitPrice, billingAmt, workDays: records.length, totalSalary,
    },
  };
}

export default function ReportPrintPage({
  type, sheet,
  contractId, startDay,
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

  const showSheet = (n) => type !== 'work' || !sheet || sheet === n;

  const sheetUrl = (n) => {
    const p = [];
    if (contractId) p.push(`contract=${contractId}`);
    if (startDay > 1) p.push(`sd=${startDay}`);
    if (n) p.push(`sheet=${n}`);
    return `/report/${year}/${month}/work${p.length ? '?' + p.join('&') : ''}`;
  };

  const billingSheetUrl = (n) => {
    const p = [];
    if (contractId) p.push(`contract=${contractId}`);
    if (startDay > 1) p.push(`sd=${startDay}`);
    if (n) p.push(`sheet=${n}`);
    return `/report/${year}/${month}/billing${p.length ? '?' + p.join('&') : ''}`;
  };
  const claimUrl = (() => {
    const p = [];
    if (contractId) p.push(`contract=${contractId}`);
    if (startDay > 1) p.push(`sd=${startDay}`);
    return `/report/${year}/${month}/claim${p.length ? '?' + p.join('&') : ''}`;
  })();
  const showBillingSheet = (n) => type !== 'billing' || !sheet || sheet === n;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; font-size: 10pt; color: #000; }
    .top-bar { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: #1f2937; display: flex; align-items: center; justify-content: space-between; padding: 0 80px; z-index: 100; gap: 12px; }
    .top-bar-left  { display: flex; gap: 6px; }
    .top-bar-center { display: flex; gap: 5px; flex: 1; justify-content: center; }
    .top-bar-right { display: flex; gap: 6px; }
    .bar-btn { padding: 6px 14px; border-radius: 5px; font-size: 13px; cursor: pointer; border: 1px solid #4b5563; background: #374151; color: #e5e7eb; text-decoration: none; white-space: nowrap; }
    .bar-btn:hover { background: #4b5563; }
    .bar-btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .bar-btn-primary:hover { background: #1d4ed8; }
    .sheet-tab { padding: 5px 12px; border-radius: 4px; font-size: 12px; text-decoration: none; color: #9ca3af; border: 1px solid #4b5563; white-space: nowrap; }
    .sheet-tab.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    @media print { .top-bar { display: none !important; } body { padding-top: 0 !important; } }

    @media screen {
      body { background: #6b7280; padding-top: 64px; padding-bottom: 20px; }
      .page, .page-land, .page-doc {
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
      @page { size: ${sheet === 3 ? 'A4 landscape' : 'A4'}; margin: 0; }
    }

    .page {
      width: 210mm; min-height: 297mm;
      margin: 0 auto; padding: 10mm 20mm;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }

    .page-doc {
      width: 210mm; height: 297mm;
      margin: 0 auto; padding: 15mm 25mm 12mm;
      page-break-after: always; overflow: hidden;
    }
    .page-doc:last-child { page-break-after: auto; }

    .page-land {
      width: 297mm; min-height: 210mm;
      margin: 0 auto; padding: 25mm 20mm 10mm;
      page-break-after: always;
    }

    h2.report-title { text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 4px; margin-bottom: 8mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }
    table.rt { width: 100%; border-collapse: collapse; font-size: 9pt; }
    table.rt th { background: #e5e7eb; color: #111; padding: 5px 6px; text-align: center; border: 1px solid #888; }
    table.rt td { border: 1px solid #888; padding: 5px 6px; text-align: center; }
    table.rt tfoot td { background: #f0f0f0; font-weight: bold; border: 1px solid #666; padding: 5px 6px; }
    table.rt td.r { text-align: right; }
    table.rt td.l { text-align: left; }
    .att-table { font-size: 7.5pt; }
    .att-table th, .att-table td { padding: 20px 3px; text-align: center; }
    .sun { color: #dc2626; }

    .doc-title { text-align: center; font-size: 20pt; font-weight: bold; letter-spacing: 10px; margin-bottom: 10mm; }
    .doc-list { margin: 2mm 0 4mm 0; list-style: none; }
    .doc-list li { display: flex; align-items: baseline; line-height: 2.4; font-size: 10.5pt; }
    .doc-list li .lbl { flex: 0 0 42mm; font-weight: bold; }
    .doc-center { text-align: center; font-weight: bold; font-size: 12pt; margin: 5mm 0; }
    .doc-body { text-align: center; font-size: 10.5pt; margin: 4mm 0; }
    .doc-sub { font-size: 10pt; margin: 2mm 0 1mm; font-weight: bold; }

    .doc-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 3mm 0; }
    .doc-table th { border: 1px solid #000; padding: 6px 6px; text-align: center; background: #fff; color: #000; font-weight: bold; }
    .doc-table td { border: 1px solid #000; padding: 6px 6px; color: #000; }
    .doc-table td.r { text-align: right; }
    .doc-table td.c { text-align: center; }
    .doc-table tfoot td { border: 1px solid #000; padding: 4px 6px; font-weight: bold; background: #f0f0f0; text-align: center; }
    .doc-table tfoot td.r { text-align: right; }

    .amount-box { border: 1px solid #000; padding: 3mm 5mm; margin: 4mm 0; font-size: 10pt; line-height: 2; }
    .req-inner { display: flex; gap: 6mm; font-size: 10.5pt; }
    .req-label { font-weight: bold; white-space: nowrap; padding-top: 1px; }
    .req-row   { display: flex; margin-bottom: 3mm; }
    .req-key   { display: inline-block; min-width: 14mm; font-weight: bold; }
    .gi-recipient { font-size: 12pt; font-weight: bold; margin-top: auto; padding-top: 8mm; }
    .gi-items    { list-style: none; margin-bottom: 10mm; }
    .gi-items li { display: flex; margin-bottom: 5mm; font-size: 10.5pt; line-height: 1.7; }
    .gi-items li .lbl { flex: 0 0 auto; font-weight: bold; white-space: nowrap; padding-right: 2mm; }
    .gi-body-text { text-align: center; font-size: 10.5pt; margin: 0mm 0 10mm; letter-spacing: 1px; }
    .gi-sec-title { font-size: 10pt; font-weight: bold; margin-bottom: 4mm; }
    .gi-acct-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 9mm; }
    .gi-acct-table th { border: 1px solid #000; padding: 9px 4px; text-align: center; background: #f0f0f0; font-weight: bold; color: #000; }
    .gi-acct-table td { border: 1px solid #000; padding: 10px 4px; text-align: center; color: #000; }
    .gi-acct-table td.r { text-align: right; }
    .gi-date-line { text-align: center; font-size: 10.5pt; margin-bottom: 10mm; }
    .gi-requester { font-size: 10.5pt; line-height: 2; }
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

      <div className="top-bar">
        <div className="top-bar-left">
          <button className="bar-btn" onClick={() => window.history.back()}>← 뒤로</button>
          <a className="bar-btn" href="/">홈</a>
        </div>
        <div className="top-bar-center">
          {type === 'work' && (<>
            <a href={sheetUrl(null)} className={`sheet-tab${!sheet ? ' active' : ''}`}>전체</a>
            <a href={sheetUrl(1)} className={`sheet-tab${sheet === 1 ? ' active' : ''}`}>계근현황</a>
            <a href={sheetUrl(2)} className={`sheet-tab${sheet === 2 ? ' active' : ''}`}>칩수거현황</a>
            <a href={sheetUrl(3)} className={`sheet-tab${sheet === 3 ? ' active' : ''}`}>일일근무현황</a>
            <a href={sheetUrl(4)} className={`sheet-tab${sheet === 4 ? ' active' : ''}`}>근무확인서</a>
            <button className="bar-btn bar-btn-primary" onClick={() => window.print()}>🖨 인쇄</button>
          </>)}
          {type === 'billing' && (<>
            <a href={billingSheetUrl(null)} className={`sheet-tab${!sheet ? ' active' : ''}`}>전체</a>
            <a href={claimUrl} className="sheet-tab">대금청구서</a>
            <a href={billingSheetUrl(1)} className={`sheet-tab${sheet === 1 ? ' active' : ''}`}>기성부분검사원</a>
            <a href={billingSheetUrl(2)} className={`sheet-tab${sheet === 2 ? ' active' : ''}`}>기성계</a>
            <a href={billingSheetUrl(3)} className={`sheet-tab${sheet === 3 ? ' active' : ''}`}>노무비청구</a>
            <a href={billingSheetUrl(4)} className={`sheet-tab${sheet === 4 ? ' active' : ''}`}>노무비지급</a>
            <button className="bar-btn bar-btn-primary" onClick={() => window.print()}>🖨 인쇄</button>
          </>)}
          {type === 'all' && (
            <button className="bar-btn bar-btn-primary" onClick={() => window.print()}>🖨 인쇄</button>
          )}
        </div>
        <div className="top-bar-right"></div>
      </div>

      {/* ══ 근무현황 그룹 ══ */}
      {showWork && (
        <>
          {/* 시트 1: 계근현황 */}
          {showSheet(1) && <span className="page-label">▌ 계근현황</span>}
          {showSheet(1) && <div className="page">
            <h2 className="report-title">{monthPad}월 계근현황</h2>
            <p style={{textAlign:'right',fontSize:'9pt',marginBottom:'4mm'}}>기간: {periodLabel}</p>
            <table className="rt" style={{tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'22%'}} />
                <col style={{width:'19%'}} />
                <col style={{width:'19%'}} />
                <col style={{width:'19%'}} />
                <col style={{width:'21%'}} />
              </colgroup>
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
                  const wt = (parseFloat(r?.weight_1)||0) + (parseFloat(r?.weight_2)||0) + (parseFloat(r?.weight_3)||0);
                  return (
                    <tr key={d}>
                      <td>{d.slice(5).replace('-', '월 ')}일</td>
                      <td>{r ? fmt(r.weight_1) : ''}</td>
                      <td>{r ? fmt(r.weight_2) : ''}</td>
                      <td>{r ? fmt(r.weight_3) : ''}</td>
                      <td style={{fontWeight:'bold'}}>{wt.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const w1 = records.reduce((s,r) => s+(parseFloat(r.weight_1)||0), 0);
                  const w2 = records.reduce((s,r) => s+(parseFloat(r.weight_2)||0), 0);
                  const w3 = records.reduce((s,r) => s+(parseFloat(r.weight_3)||0), 0);
                  return (
                    <tr>
                      <td>계</td>
                      <td>{w1 > 0 ? w1.toFixed(3) : ''}</td>
                      <td>{w2 > 0 ? w2.toFixed(3) : ''}</td>
                      <td>{w3 > 0 ? w3.toFixed(3) : ''}</td>
                      <td>{totalW.toFixed(3)}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>}

          {/* 시트 2: 칩수거현황 */}
          {showSheet(2) && <span className="page-label">▌ 칩수거현황</span>}
          {showSheet(2) && <div className="page">
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
                      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  );
                  const s3 = (r.chip_3l||0)*3, s5 = (r.chip_5l||0)*5;
                  const s20 = (r.chip_20l||0)*20, s120 = (r.chip_120l||0)*120;
                  return (
                    <tr key={d}>
                      <td>{d.slice(5).replace('-', '월 ')}일</td>
                      <td>{r.chip_3l||0}</td>  <td>{s3.toLocaleString()}</td>
                      <td>{r.chip_5l||0}</td>  <td>{s5.toLocaleString()}</td>
                      <td>{r.chip_20l||0}</td> <td>{s20.toLocaleString()}</td>
                      <td>{r.chip_120l||0}</td><td>{s120.toLocaleString()}</td>
                      <td style={{fontWeight:'bold'}}>{(s3+s5+s20+s120).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>합 계</td>
                  <td>{total3l}</td>  <td>{(total3l*3).toLocaleString()}</td>
                  <td>{total5l}</td>  <td>{(total5l*5).toLocaleString()}</td>
                  <td>{total20l}</td> <td>{(total20l*20).toLocaleString()}</td>
                  <td>{total120l}</td><td>{(total120l*120).toLocaleString()}</td>
                  <td>{(total3l*3+total5l*5+total20l*20+total120l*120).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>}

          {/* 시트 3: 일일 근무현황 (가로) */}
          {showSheet(3) && <span className="page-label">▌ 일일 근무현황</span>}
          {showSheet(3) && <div className="page-land">
            <h2 className="report-title"> {settings.company_name || '진우환경'} 일일 근무현황 ({monthPad}월)</h2>
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
                        <td style={{fontWeight:'bold'}}>{w.name}</td>
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
                    <td style={{fontWeight:'bold',fontSize:'7.5pt'}}>일 근무인원</td>
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
          </div>}
        </>
      )}

      {/* ══ 기성/청구 그룹 ══ */}
      {showBilling && (
        <>
         {/* 시트 1: 기성부분검사원 */}
          {showBillingSheet(1) && <span className="page-label">▌ 기성부분검사원</span>}
          {showBillingSheet(1) && <div className="page-doc" style={{padding:'10mm 12mm 10mm', display:'flex', flexDirection:'column'}}>{(() => {
              const fd = (d) => { if(!d) return ''; const p=d.split('-'); return p.length===3?`${p[0]}년 ${p[1]}월 ${p[2]}일`:d; };
              const b  = {border:'1px solid #000', padding:'5px 8px'};
              const lb = {...b, fontWeight:'bold', background:'#f5f5f5', textAlign:'center', whiteSpace:'nowrap'};
              return (<>
                {/* 외곽 테두리 박스 */}
                <div style={{border:'1px solid #000', flex:1, display:'flex', flexDirection:'column'}}>
                  {/* 테이블 1: 계약자 정보 — colgroup으로 독립 너비 조정 가능 */}
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10pt',tableLayout:'fixed'}}>
                    <colgroup>
                      <col style={{width:'5%'}} />
                      <col style={{width:'15%'}} />
                      <col style={{width:'46%'}} />
                      <col style={{width:'13%'}} />
                      <col style={{width:'21%'}} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan="5" style={{...lb, textAlign:'center', fontSize:'15pt', letterSpacing:'8px', padding:'4mm 0', background:'#fff', border:'none', borderBottom:'1px solid #000'}}>
                          기 성 부 분 검 사 원
                        </td>
                      </tr>
                      <tr>
                        <td rowSpan="2" style={{...lb, writingMode:'vertical-lr', textOrientation:'upright', letterSpacing:'4px', fontSize:'12pt', borderLeft:'none'}}>계약자</td>
                        <td style={lb}>업 체 명</td>
                        <td style={b}>{settings.company_name}</td>
                        <td style={lb}>대 표 자</td>
                        <td style={{...b, borderRight:'none'}}>{settings.ceo_name}</td>
                      </tr>
                      <tr>
                        <td style={lb}>사업장소재지</td>
                        <td style={b}>{settings.company_addr}</td>
                        <td style={lb}>전화번호</td>
                        <td style={{...b, borderRight:'none'}}>{settings.company_tel || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                  {/* 테이블 2: 계약 내용 — colgroup으로 독립 너비 조정 가능 */}
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11pt',tableLayout:'fixed',marginTop:'-1px'}}>
                    <colgroup>
                      <col style={{width:'20%'}} />
                      <col style={{width:'30%'}} />
                      <col style={{width:'16%'}} />
                      <col style={{width:'34%'}} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td style={{...lb, borderLeft:'none'}}>용 역 명</td>
                        <td colSpan="3" style={{...b, borderRight:'none'}}>{contractName}</td>
                      </tr>
                      <tr>
                        <td style={{...lb, borderLeft:'none'}}>계 약 금 액</td>
                        <td style={b}>톤당 : {unitPrice.toLocaleString()}원</td>
                        <td style={lb}>기성부분<br/>준공금액</td>
                        <td style={{...b, borderRight:'none'}}>일금 : {billingAmt.toLocaleString()}원<br/>(일금 {toKorean(billingAmt)} 원정)</td>
                      </tr>
                      <tr>
                        <td style={{...lb, borderLeft:'none'}}>계 약 일 자</td>
                        <td style={b}>{fd(contractStart)}</td>
                        <td style={lb}>착 공 일 자</td>
                        <td style={{...b, borderRight:'none'}}>{fd(constStart)}</td>
                      </tr>
                      <tr>
                        <td style={{...lb, borderLeft:'none'}}>준 공 기 한</td>
                        <td style={b}>{fd(contractEnd)}</td>
                        <td style={lb}>준 공 일 지</td>
                        <td style={{...b, borderRight:'none'}}>{fd(contractEnd)}</td>
                      </tr>
                      <tr>
                        <td style={{...lb, verticalAlign:'center', borderLeft:'none'}}>용역이행사항</td>
                        <td colSpan="3" style={{...b, lineHeight:'2.2', textAlign:'left', borderRight:'none'}}>
                          <div>○ 용역이행기간 : {ps.replace(/-/g,'.')} ~ {pe.replace(/-/g,'.')}.</div>
                          <div>○ 수집운반량 : {totalW.toFixed(3)}톤</div>
                          <div>○ 산출기초 : {totalW.toFixed(3)}톤 × {unitPrice.toLocaleString()}원 = {billingAmt.toLocaleString()}원</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                {/* 본문 + 서명 영역 (외곽 박스 안) */}
                <div style={{flex:1, padding:'10mm 8mm', display:'flex', flexDirection:'column'}}>
                  <div style={{textAlign:'center', fontSize:'12pt', lineHeight:'2', marginBottom:'3mm'}}>
                    위 용역에 대한 과업지시서 및 기타계약조건의 내용과 같이<br/>
                    기성 되었기에 기성부분검사원을 제출합니다.
                  </div>
                  <div style={{textAlign:'center', fontSize:'12pt', margin:'3mm 0'}}>
                    {year}년 {monthPad}월　　일
                  </div>
                  <div style={{textAlign:'right', fontSize:'12pt', marginTop:'4mm'}}>
                    <div style={{marginBottom:'6mm'}}>업 체 명 : {settings.company_name}</div>
                    <div>대 표 자 : {(settings.ceo_name||'').split('').join(' ')}　　(인)</div>
                  </div>
                  <div style={{fontWeight:'bold', textDecoration:'underline', fontSize:'12pt', marginTop:'auto', paddingTop:'4mm'}}>
                    {recipient2 || clientName}수&nbsp;&nbsp;귀하
                  </div>
                </div>
              </div>

              {/* 구비서류 (외곽 박스 아래 별도 영역) */}
              <div style={{border:'1px solid #000', marginTop:'0mm', padding:'3mm 5mm 15mm', fontSize:'10pt',borderTop:'none'}}>
                &lt;구비서류&gt;
              </div>
            </>);
          })()}</div>}

          {/* 시트 2: 기성계 */}
          {showBillingSheet(2) && <span className="page-label">▌ 기성계</span>}
          {showBillingSheet(2) && <div className="page-doc" style={{display:'flex', flexDirection:'column'}}>
            <div className="doc-title" style={{textDecoration:'underline', textUnderlineOffset:'6px', letterSpacing:'12px', marginBottom:'5mm'}}>
기　성　계</div>
            <div className="gi-subtitle" style={{textAlign:'center', fontSize:'11pt', marginBottom:'20mm'}}>(기성금: {monthPad}월)</div>
            <ul className="gi-items">
              <li><span className="lbl">○ 계 약 건 명 :</span> {contractName}</li>
              <li><span className="lbl">○ 계 약 금 액 :</span> 금 {toKorean(contractAmt).replace('원정','').trim()} 원정 (₩{contractAmt.toLocaleString()})</li>
              <li><span className="lbl">○ 금회기성금액 :</span> 금 {toKorean(billingAmt).replace('원정','').trim()} 원정 (₩{billingAmt.toLocaleString()})</li>
              <li><span className="lbl">○ 청 구 금 액 :</span> 금 {toKorean(billingAmt).replace('원정','').trim()} 원정 (₩{billingAmt.toLocaleString()})</li>
              <li><span className="lbl">○ 계약 연월일 :</span> {contractStart ? contractStart.replace(/-/g,'년 ').replace(/-/,'월 ')+'일' : ''}</li>
            </ul>
            <div className="gi-body-text">위와 같이 청구하오니 아래 계좌에 입금하여 주시기 바랍니다.</div>
            <div className="gi-sec-title">○ 입금의뢰 계좌내용</div>
            <table className="gi-acct-table">
              <thead>
                <tr>
                  <th>구분</th><th>은행명</th><th>채주성명</th>
                  <th>청구금액</th><th>예금종류</th><th>계좌번호</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{fontWeight:'bold'}}>운반업체</td>
                  <td>{settings.bank_name || ''}</td>
                  <td>{settings.company_name || ''}</td>
                  <td className="r">{billingAmt.toLocaleString()}</td>
                  <td>{settings.bank_type || ''}</td>
                  <td>{settings.bank_account || ''}</td>
                </tr>
              </tbody>
            </table>
            <div className="gi-date-line">{year}년 {monthPad}월　　　일</div>
            <div className="gi-requester">
              <div className="req-inner">
                <span className="req-label">위 청구인(계약자)</span>
                <div>
                  <div className="req-row">
                    <span className="req-key">주　소 :</span>
                    <span>&nbsp;{settings.company_addr || ''}</span>
                  </div>
                  <div className="req-row">
                    <span className="req-key">상　호 :</span>
                    <span>&nbsp;{settings.company_name || ''}</span>
                  </div>
                  <div className="req-row">
                    <span className="req-key">성　명 :</span>
                    <span>&nbsp;{(settings.ceo_name||'').split('').join(' ')}　　(인)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="gi-recipient">
              {recipient1 || clientName}&nbsp;&nbsp;귀하
            </div>
          </div>}

          {/* 시트 3: 노무비청구내역서 */}
          {showBillingSheet(3) && <span className="page-label">▌ 노무비청구내역서</span>}
          {showBillingSheet(3) && <div className="page-doc">
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
          </div>}

          {/* 시트 4: 노무비지급내역서 */}
          {showBillingSheet(4) && <span className="page-label">▌ 노무비지급내역서</span>}
          {showBillingSheet(4) && <div className="page-doc">
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
          </div>}
        </>
      )}

      {/* ══ 근무확인서 (근무현황 그룹 마지막) ══ */}
      {showWork && (
        <>
          {showSheet(4) && <span className="page-label">▌ 근무확인서</span>}
          {showSheet(4) && <div className="page" style={{paddingTop:'20mm'}}>
            <h2 className="report-title">근 무 확 인 서</h2>
            <div style={{textAlign:'right',fontSize:'9pt',marginBottom:'5mm'}}>
              {monthPad}월 ({area}) &nbsp; 이행기간: {periodLabel}
            </div>
            <table className="rt">
              <thead>
                <tr>
                  <th style={{padding:'20px 6px'}}>성 명</th>
                  <th style={{padding:'20px 6px'}}>직 위</th>
                  <th style={{padding:'20px 6px'}}>생년월일</th>
                  <th style={{padding:'20px 6px'}}>비　고</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td style={{fontWeight:'bold',padding:'20px 6px'}}>{w.name}</td>
                    <td style={{padding:'20px 6px'}}>{w.position}</td>
                    <td style={{padding:'20px 6px'}}>{w.dob}</td>
                    <td style={{padding:'20px 6px'}}></td>
                  </tr>
                ))}
                {Array.from({length: Math.max(0, 4 - workers.length)}).map((_, i) => (
                  <tr key={`emp-${i}`}>
                    <td style={{padding:'20px 6px'}}>&nbsp;</td>
                    <td style={{padding:'20px 6px'}}></td>
                    <td style={{padding:'20px 6px'}}></td>
                    <td style={{padding:'20px 6px'}}></td>
                  </tr>
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
          </div>}
        </>
      )}
    </>
  );
}
