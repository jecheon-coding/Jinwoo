import supabase from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

ClaimPage.noLayout = true;

function toKorean(n) {
  if (!n || n === 0) return '영';
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
  if (eok  > 0) result += group4(eok) + '억';
  if (man  > 0) result += group4(man) + '만';
  if (rest > 0) result += group4(rest);
  return result;
}

function amtFmt(n) {
  const num = Math.floor(n || 0);
  if (num === 0) return '금 영 원정';
  return `금 ${toKorean(num)} 원정 (₩${num.toLocaleString()})`;
}

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, true);
  if (authRedirect) return authRedirect;

  const year       = parseInt(params.year);
  const month      = parseInt(params.month);
  const contractId = query.contract ? parseInt(query.contract) : null;
  const sdParam    = query.sd ? parseInt(query.sd) : null;

  const [setRes, contRes] = await Promise.all([
    supabase.from('settings').select('*'),
    contractId
      ? supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
      : supabase.from('contracts').select('*').eq('active', true).order('sort_order').order('id').limit(1),
  ]);

  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });
  const contract = contractId
    ? (contRes.data || null)
    : (Array.isArray(contRes.data) ? contRes.data[0] : contRes.data) || null;

  const startDay = sdParam ?? parseInt(settings.period_start_day) ?? 1;
  const pad = n => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  let ps;
  if (startDay <= 1) {
    ps = `${year}-${pad(month)}-01`;
  } else {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    ps = `${py}-${pad(pm)}-${pad(startDay)}`;
  }
  const pe = `${year}-${pad(month)}-${pad(lastDay)}`;

  let recQ = supabase.from('records')
    .select('weight_1,weight_2,weight_3')
    .gte('record_date', ps).lte('record_date', pe);
  if (contractId) recQ = recQ.eq('contract_id', contractId);
  const recRes = await recQ;

  const records = recRes.data || [];
  const totalW  = records.reduce((s, r) =>
    s + (parseFloat(r.weight_1)||0) + (parseFloat(r.weight_2)||0) + (parseFloat(r.weight_3)||0), 0);
  const unitPrice  = parseFloat(contract?.unit_price) || parseFloat(settings.unit_price) || 0;
  const billingAmt = Math.floor(totalW * unitPrice / 1000) * 1000;

  return {
    props: { year, month, contractId: contractId || null, startDay, settings, contract: contract || {}, billingAmt },
  };
}

export default function ClaimPage({ year, month, contractId, startDay, settings, contract, billingAmt }) {
  const monthPad = String(month).padStart(2, '0');

  const billingUrl = (sheet) => {
    const p = [];
    if (contractId) p.push(`contract=${contractId}`);
    if (startDay > 1) p.push(`sd=${startDay}`);
    if (sheet) p.push(`sheet=${sheet}`);
    return `/report/${year}/${month}/billing${p.length ? '?' + p.join('&') : ''}`;
  };

  const contractName   = contract?.name               || settings.contract_name   || '';
  const contractAmt    = parseInt(contract?.amount)   || 0;
  const contractStart  = contract?.contract_start     || settings.contract_start  || '';
  const companyName    = settings.company_name        || '';
  const ceoName        = settings.ceo_name            || '';
  const bankName       = settings.bank_name           || '';
  const bankAccount    = settings.bank_account        || '';
  const bankType       = settings.bank_type           || '';
  const companyAddress = settings.company_addr        || '';
  const clientTitle    = contract?.client_recipient_1 || settings.client_recipient_1 || '';

  let contractDateStr = '';
  if (contractStart) {
    const p = contractStart.split('-');
    if (p.length === 3) contractDateStr = `${p[0]}년 ${p[1]}월 ${p[2]}일`;
  }

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; font-size: 11pt; background: #6b7280; color: #000; }
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
    @media screen { body { padding-top: 64px; padding-bottom: 20px; } .page { box-shadow: 0 4px 20px rgba(0,0,0,0.3); margin: 0 auto 40px; } }
    @media print {
      .top-bar { display: none !important; }
      body { background: #fff; padding-top: 0; }
      @page { size: A4 portrait; margin: 0; }
    }
    .page {
      width: 210mm; height: 297mm;
      padding: 30mm 20mm 20mm;
      background: #fff; font-size: 11pt; line-height: 1.7;
      display: flex; flex-direction: column;
    }
    .title    { text-align: center; font-size: 24pt; font-weight: bold; letter-spacing: 12px; margin-bottom: 0mm; }
    .subtitle { text-align: center; font-size: 14pt; margin-bottom: 20mm; }
    .items    { list-style: none; margin-bottom: 10mm; }
    .items li { display: flex; margin-bottom: 5mm; font-size: 12pt; line-height: 1.7; }
    .items li .lbl { flex: 0 0 auto;  white-space: nowrap; padding-right: 2mm; }
    .body-text { text-align: center; font-size: 12pt; margin: 0mm 0 10mm; letter-spacing: 1px; }
    .sec-title { font-size: 11pt; font-weight: bold; margin-bottom: 4mm; }
    .acct-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 9mm; }
    .acct-table th { border: 1px solid #000; padding: 9px 4px; text-align: center; background: #f0f0f0; font-weight: bold; color: #000; font-size: 10.5pt; }
    .acct-table td { border: 1px solid #000; padding: 10px 4px; text-align: center; color: #000; }
    .date-line { text-align: center; font-size: 11.5pt; margin-bottom: 10mm; }
    .requester { font-size: 12pt; line-height: 2; flex: 1; }
    .req-inner { display: flex; gap: 6mm; }
    .req-label {  white-space: nowrap; padding-top: 1px; }
    .req-rows  {}
    .req-row   { display: flex; margin-bottom: 3mm; }
    .req-key   { display: inline-block; min-width: 14mm }
    .recipient { font-size: 20pt; font-weight: bold; margin-top: auto; padding-top: 8mm; }
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
          <a href={billingUrl(null)} className="sheet-tab">전체</a>
          <span className="sheet-tab active">대금청구서</span>
          <a href={billingUrl(1)} className="sheet-tab">기성부분검사원</a>
          <a href={billingUrl(2)} className="sheet-tab">기성계</a>
          <a href={billingUrl(3)} className="sheet-tab">노무비청구</a>
          <a href={billingUrl(4)} className="sheet-tab">노무비지급</a>
          <button className="bar-btn bar-btn-primary" onClick={() => window.print()}>🖨 인쇄</button>
        </div>
        <div className="top-bar-right"></div>
      </div>
      <div className="page">

        <div className="title">대 금 청 구 서</div>
        <div className="subtitle">(기성금: {monthPad}월)</div>

        <ul className="items">
          <li>
            <span className="lbl">○ 계　약　건　명　:</span>
            <span>{contractName}</span>
          </li>
          <li>
            <span className="lbl">○ 계　약　금　액　:</span>
            <span>{amtFmt(contractAmt)}</span>
          </li>
          <li>
            <span className="lbl">○ 금회　기성금액　:</span>
            <span>{amtFmt(billingAmt)}</span>
          </li>
          <li>
            <span className="lbl">○ 청　구　금　액　:</span>
            <span>{amtFmt(billingAmt)}</span>
          </li>
          <li>
            <span className="lbl">○ 계　약　연월일　:</span>
            <span>{contractDateStr}</span>
          </li>
        </ul>

        <div className="body-text">
          위와 같이 청구하오니 아래 계좌에 입금하여 주시기 바랍니다.
        </div>

        <div className="sec-title">○ 입금의뢰 계좌내용</div>
        <table className="acct-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>은행명</th>
              <th>채무성명</th>
              <th>청구금액</th>
              <th>예금종류</th>
              <th>계좌번호</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>운반업체</td>
              <td>{bankName}</td>
              <td>{companyName}</td>
              <td>{billingAmt.toLocaleString()}</td>
              <td>{bankType}</td>
              <td>{bankAccount}</td>
            </tr>
          </tbody>
        </table>

        <div className="date-line">
          {year}년 {monthPad}월　　일
        </div>

        <div className="requester">
          <div className="req-inner">
            <span className="req-label">위 청구인(계약자)</span>
            <div className="req-rows">
              <div className="req-row">
                <span className="req-key">주　소 :</span>
                <span>&nbsp;{companyAddress}</span>
              </div>
              <div className="req-row">
                <span className="req-key">상　호 :</span>
                <span>&nbsp;{companyName}</span>
              </div>
              <div className="req-row">
                <span className="req-key">성　명 :</span>
                <span>&nbsp;{ceoName.split('').join(' ')}&nbsp;&nbsp;&nbsp;(인)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="recipient">
          {clientTitle}&nbsp;&nbsp;&nbsp;귀하
        </div>

      </div>
    </>
  );
}
