import supabase from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

LogPage.noLayout = true;

const DAYS = ['일','월','화','수','목','금','토'];

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, false);
  if (authRedirect) return authRedirect;

  const { date } = params;
  const contractId = query.contract ? parseInt(query.contract) : null;

  let recQ  = supabase.from('records').select('*').eq('record_date', date);
  let attQ  = supabase.from('attendance').select('*').eq('record_date', date);
  if (contractId) {
    recQ = recQ.eq('contract_id', contractId);
    attQ = attQ.eq('contract_id', contractId);
  }

  const [recRes, wRes, attRes, setRes] = await Promise.all([
    recQ.maybeSingle(),
    supabase.from('workers').select('*').eq('active', true).order('sort_order').order('id'),
    attQ,
    supabase.from('settings').select('*'),
  ]);

  const settings = {};
  (setRes.data || []).forEach(r => { settings[r.key] = r.value; });

  const attMap = {};
  (attRes.data || []).forEach(a => { attMap[a.worker_id] = a.value; });

  // 출근한 작업자만 필터
  const presentWorkers = (wRes.data || []).filter(w => (attMap[w.id] || 0) > 0);

  return {
    props: {
      date,
      record: recRes.data || null,
      presentWorkers,
      settings,
    },
  };
}

export default function LogPage({ date, record, presentWorkers, settings }) {
  const d    = new Date(date);
  const dow  = DAYS[d.getDay()];
  const ymd  = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;

  const r = record || {};
  const startKm = r.start_km != null ? Number(r.start_km).toFixed(3) : '';
  const endKm   = r.end_km   != null ? Number(r.end_km).toFixed(3)   : '';
  const dist    = (r.start_km != null && r.end_km != null)
    ? (Number(r.end_km) - Number(r.start_km)).toFixed(3) : '';

  const w1 = r.weight_1 ? Number(r.weight_1).toFixed(3) : '';
  const w2 = r.weight_2 ? Number(r.weight_2).toFixed(3) : '';
  const w3 = r.weight_3 ? Number(r.weight_3).toFixed(3) : '';

  const workerNames = presentWorkers.map(w => w.name).join(', ');

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; background:#fff; color:#000; }
    .print-btn { position: fixed; top: 12px; right: 12px; background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 100; }
    @media print { .print-btn { display: none; } @page { size: A4; margin: 8mm; } }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 8mm; font-size: 10pt; }
    .main-title { text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 6px; margin-bottom: 5mm; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; font-size: 10pt; }
    .label { background: #f0f0f0; text-align: center; font-weight: bold; white-space: nowrap; }
    .section-title { text-align: center; font-weight: bold; font-size: 11pt; letter-spacing: 4px; background: #f5f5f5; }
    .approval-cell { text-align: center; min-width: 18mm; min-height: 14mm; }
    .tall { height: 10mm; }
    .taller { height: 14mm; }
    .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; margin-right: 3px; text-align: center; line-height: 11px; font-size: 10px; vertical-align: middle; }
    .checked::after { content: '✓'; font-size: 9px; }
    .footer-company { text-align: right; font-size: 9pt; margin-top: 3mm; font-weight: bold; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <button className="print-btn" onClick={() => window.print()}>🖨 인쇄</button>

      <div className="page">
        <div className="main-title">차 량 운 행 일 지 ( 작 업 일 지 )</div>

        {/* ── 상단: 날짜/차량/결재 ── */}
        <table style={{marginBottom:'3mm'}}>
          <tbody>
            <tr>
              <td className="label" style={{width:'18mm'}}>날&nbsp;&nbsp;&nbsp;짜</td>
              <td style={{width:'40mm'}}>{ymd}</td>
              <td className="label" style={{width:'12mm'}}>요 일</td>
              <td style={{width:'12mm',textAlign:'center',fontWeight:'bold'}}>{dow}</td>
              <td rowSpan="3" className="label" style={{width:'10mm',writingMode:'vertical-rl',letterSpacing:'4px'}}>결재</td>
              <td className="label approval-cell" style={{width:'20mm'}}>담&nbsp;&nbsp;당</td>
              <td className="label approval-cell" style={{width:'20mm'}}>대표이사</td>
            </tr>
            <tr>
              <td className="label">차 량 번 호</td>
              <td colSpan="3">{r.vehicle_number || settings.vehicle_number || ''}</td>
              <td className="taller"></td>
              <td className="taller"></td>
            </tr>
            <tr>
              <td className="label">운&nbsp;&nbsp;전&nbsp;&nbsp;자</td>
              <td colSpan="3">{r.driver || settings.driver || ''}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* ── 차량운행상황 ── */}
        <table style={{marginBottom:'3mm'}}>
          <tbody>
            <tr>
              <td colSpan="6" className="section-title">차 량 운 행 상 황</td>
            </tr>
            <tr>
              <td className="label" rowSpan="3" style={{width:'8mm',writingMode:'vertical-rl',letterSpacing:'2px'}}>운행내역</td>
              <td className="label" style={{width:'18mm'}}>운행시작</td>
              <td style={{width:'28mm'}}>{startKm}</td>
              <td className="label" style={{width:'8mm'}}>km</td>
              <td className="label" rowSpan="3" style={{width:'14mm',writingMode:'vertical-rl',letterSpacing:'2px'}}>연료내역</td>
              <td style={{width:'60mm'}}>
                <table style={{border:'none',width:'100%'}}>
                  <tbody>
                    <tr>
                      <td style={{border:'none',width:'50%'}} className="label">주&nbsp;&nbsp;유&nbsp;&nbsp;량</td>
                      <td style={{border:'none',width:'30%'}}>{r.fuel || ''}</td>
                      <td style={{border:'none',width:'20%'}} className="label">ℓ</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td className="label">운행종료</td>
              <td>{endKm}</td>
              <td className="label">km</td>
              <td style={{verticalAlign:'top',paddingTop:'2mm'}}>
                <span className="label" style={{display:'inline-block',padding:'1px 4px'}}>기&nbsp;&nbsp;&nbsp;타</span>
              </td>
            </tr>
            <tr>
              <td className="label">운행거리</td>
              <td>{dist}</td>
              <td className="label">km</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* ── 행선지/운행시간/내역 ── */}
        <table style={{marginBottom:'3mm'}}>
          <tbody>
            <tr>
              <td className="label" style={{width:'22mm'}}>행&nbsp;&nbsp;선&nbsp;&nbsp;지</td>
              <td className="label" style={{width:'38mm'}}>운&nbsp;&nbsp;행&nbsp;&nbsp;시&nbsp;&nbsp;간</td>
              <td className="label">내&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;역</td>
            </tr>
            <tr className="tall">
              <td>{r.route ? r.route.split(' ')[0] || '' : ''}</td>
              <td style={{textAlign:'center'}}>
                {r.op_start && r.op_end ? `${r.op_start} ~ ${r.op_end}` : ''}
              </td>
              <td>{r.route || ''}</td>
            </tr>
            <tr className="tall"><td></td><td></td><td></td></tr>
            <tr className="tall"><td></td><td></td><td></td></tr>
            <tr className="tall"><td></td><td></td><td></td></tr>
          </tbody>
        </table>

        {/* ── 작업인 / 작업내용 ── */}
        <table style={{marginBottom:'3mm'}}>
          <tbody>
            <tr>
              <td className="label" style={{width:'18mm'}}>작&nbsp;&nbsp;업&nbsp;&nbsp;인</td>
              <td>{workerNames}</td>
            </tr>
            <tr>
              <td className="label" rowSpan="3">작업내용</td>
              <td className="tall">
                <span className={`checkbox ${record ? 'checked' : ''}`}></span> 음식물 수거
              </td>
            </tr>
            <tr>
              <td className="tall">
                <span className="checkbox"></span> 민원 내용:
              </td>
            </tr>
            <tr>
              <td className="tall">
                <span className="checkbox"></span> 기&nbsp;&nbsp;&nbsp;타: {r.notes || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── 계근량 / 칩수거현황 / 운행횟수 ── */}
        <table>
          <tbody>
            <tr>
              <td colSpan="3" className="section-title" style={{width:'55mm'}}>계&nbsp;&nbsp;근&nbsp;&nbsp;량</td>
              <td rowSpan="3" className="label" style={{width:'10mm',writingMode:'vertical-rl',letterSpacing:'2px'}}>칩수거현황</td>
              <td className="label" style={{width:'10mm'}}>3ℓ</td>
              <td style={{width:'14mm',textAlign:'right'}}>{r.chip_3l || 0}</td>
              <td className="label" style={{width:'8mm'}}>개</td>
              <td rowSpan="3" className="label" style={{width:'20mm',textAlign:'center',lineHeight:'1.6'}}>
                운행 횟수<br/>(환경사업소)
              </td>
            </tr>
            <tr>
              <td className="label" style={{width:'18mm'}}>1차</td>
              <td className="label" style={{width:'18mm'}}>2차</td>
              <td className="label" style={{width:'19mm'}}>비고</td>
              <td className="label">5ℓ</td>
              <td style={{textAlign:'right'}}>{r.chip_5l || 0}</td>
              <td className="label">개</td>
            </tr>
            <tr>
              <td style={{height:'14mm',fontSize:'11pt',fontWeight:'bold',textAlign:'center'}}>{w1}</td>
              <td style={{textAlign:'center'}}>{w2}</td>
              <td></td>
              <td className="label">20ℓ</td>
              <td style={{textAlign:'right'}}>{r.chip_20l || 0}</td>
              <td className="label">개</td>
            </tr>
            <tr>
              <td colSpan="3"></td>
              <td className="label" style={{textAlign:'right',paddingRight:'2mm'}}></td>
              <td className="label">120ℓ</td>
              <td style={{textAlign:'right'}}>{r.chip_120l || 0}</td>
              <td className="label">개</td>
              <td style={{textAlign:'center',fontSize:'13pt',fontWeight:'bold'}}>
                {r.trips || 1} 회
              </td>
            </tr>
          </tbody>
        </table>

        <div className="footer-company">{settings.company_name || '주식회사 진우환경'}</div>
      </div>
    </>
  );
}
