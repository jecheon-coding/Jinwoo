import Link from 'next/link';
import dynamic from 'next/dynamic';
import supabase from '../../lib/supabase';
import { requireAuth } from '../../lib/auth';

LogPage.noLayout = true;

const LogPDFButton = dynamic(() => import('../../components/LogPDFButton'), { ssr: false });

const DAYS = ['일','월','화','수','목','금','토'];

function fmtKm(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(3);
}

function fmtChip(v) {
  return v ? String(v) : '';
}

function fmtName(v) {
  return v ? v.split('').join(' ') : '';
}

export async function getServerSideProps({ req, params, query }) {
  const authRedirect = requireAuth(req, false);
  if (authRedirect) return authRedirect;

  const { date } = params;
  const contractId = query.contract ? parseInt(query.contract) : null;

  let recQ = supabase.from('records').select('*').eq('record_date', date);
  let attQ = supabase.from('attendance').select('*').eq('record_date', date);
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
  const presentWorkers = (wRes.data || []).filter(w => (attMap[w.id] || 0) > 0);

  return {
    props: { date, record: recRes.data || null, presentWorkers, settings },
  };
}

export default function LogPage({ date, record, presentWorkers, settings }) {
  const d   = new Date(date);
  const dow = DAYS[d.getDay()];
  const ymd = `${d.getFullYear()}.  ${d.getMonth()+1}.  ${d.getDate()}.`;

  const r        = record || {};
  const startKm  = fmtKm(r.start_km);
  const endKm    = fmtKm(r.end_km);
  const dist     = (r.start_km != null && r.end_km != null)
    ? fmtKm(Number(r.end_km) - Number(r.start_km)) : '';
  const w1 = r.weight_1 ? Number(r.weight_1).toFixed(3) : '';
  const w2 = r.weight_2 ? Number(r.weight_2).toFixed(3) : '';
  const driverName  = r.driver || settings.driver || '';
  const workerNames = presentWorkers.filter(w => w.name !== driverName).map(w => w.name).join(', ');
  const area = r.route ? r.route.split('(')[0].split(' ')[0] + ' ~' : '';

  const pdfProps = { date, record, presentWorkers, settings };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; background: #e5e7eb; color: #000; }

        .btn-bar {
          position: sticky; top: 0; z-index: 100;
          display: flex; justify-content: center; gap: 8px;
          padding: 10px; background: #e5e7eb;
        }
        @media print { .btn-bar { display: none !important; } }
        .btn-back {
          background: #fff; color: #374151; border: 1px solid #9ca3af;
          padding: 7px 18px; border-radius: 6px; font-size: 13px;
          text-decoration: none; display: inline-block;
        }
        .btn-print {
          background: #16a34a; color: #fff; border: none;
          padding: 7px 18px; border-radius: 6px; font-size: 13px; cursor: pointer;
        }

        @media screen {
          .page { box-shadow: 0 4px 20px rgba(0,0,0,0.3); margin: 0 auto 40px; }
        }
        @media print {
          body { background: #fff; }
          @page { size: A4 portrait; margin: 10mm 12mm; }
        }
        .page {
          width: 210mm;
          min-height: 277mm;
          padding: 20mm 11mm 9mm 11mm;
          background: #fff;
          font-size: 11pt;
        }

        .title {
          text-align: center; font-size: 17pt; font-weight: bold;
          letter-spacing: 6px; margin-bottom: 7mm;
        }

        table { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed; border: 2px solid #000; }
        td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          border-top: 1px solid #000;
          border-left: 0;
          padding: 3px 7px;
          vertical-align: middle;
          font-size: 11pt;
          word-break: keep-all;
          background: #fff;
          line-height: 1.4;
        }
        td:last-child { border-right: 0; }
        tr:first-child td { border-top: 0; }
        tr:last-child td { border-bottom: 0; }

        .lbl {
          background: #fff; text-align: center;
          font-weight: bold; white-space: nowrap;
        }
        .sec {
          background: #fff; text-align: center;
          font-weight: bold; font-size: 12pt; letter-spacing: 4px; padding: 5px;
        }
        .vert {
          writing-mode: vertical-rl; text-orientation: mixed;
          white-space: nowrap; letter-spacing: 3px; text-align: center;
        }
        .num { text-align: right; padding-right: 7px; }

        .h9  { height: 6mm; }
        .h11 { height: 10mm; }
        .h12 td { padding-top: 2px !important; padding-bottom: 2px !important; }
        .h13 { height: 10mm; }
        .h15 { height: 10mm; }

        .cb {
          display: inline-block; width: 12px; height: 12px;
          border: 1.5px solid #000; margin-right: 5px;
          text-align: center; line-height: 11px; font-size: 11px;
          vertical-align: middle;
        }
        .cb-on::after { content: '✓'; }

        .mt { margin-top: 3mm; }

        .header-wrap { display: flex; gap: 25mm; align-items: stretch; margin-bottom: 4mm; }
        .header-left  { flex: 0 0 90mm; }
        .header-right { flex: ; }
        .header-left table, .header-right table { height: 100%; width: 100%; }

        .footer { text-align: right; font-size: 11pt; margin-top: 4mm; font-weight: bold; }
      `}} />

      <div className="btn-bar">
        <Link href="/history" className="btn-back">← 뒤로</Link>
        <button className="btn-print" onClick={() => window.print()}>🖨 인쇄</button>
        <LogPDFButton {...pdfProps} />
      </div>

      <div className="page">
        <div className="title">차 량 운 행 일 지 ( 작 업 일 지 )</div>

        {/* ── 상단: 날짜·차량 + 결재 ── */}
        <div className="header-wrap">
          <div className="header-left">
            <table>
              <colgroup>
                <col />
                <col style={{width:'55mm'}} />
              </colgroup>
              <tbody>
                <tr className="h12">
                  <td style={{paddingLeft:'8px'}}>{ymd}</td>
                  <td style={{paddingLeft:'10px', textAlign:'left'}}>요 일 : {dow}</td>
                </tr>
                <tr className="h12">
                  <td className="lbl" style={{letterSpacing:'2px'}}>차 량 번 호</td>
                  <td style={{paddingLeft:'10px', textAlign:'left'}}>{r.vehicle_number || settings.vehicle_number || ''}</td>
                </tr>
                <tr className="h12">
                  <td className="lbl" style={{letterSpacing:'2px'}}>운 &nbsp;&nbsp;전 &nbsp;&nbsp;자</td>
                  <td style={{paddingLeft:'10px', textAlign:'left'}}>{fmtName(r.driver || settings.driver || '')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="header-right">
            <table>
              <colgroup>
                <col style={{width:'12mm'}} />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr style={{height:'11mm'}}>
                  <td rowSpan="2" className="vert" style={{fontWeight:'bold',letterSpacing:'4px'}}>결&nbsp;재</td>
                  <td className="lbl" style={{letterSpacing:'2px'}}>담&nbsp;&nbsp;당</td>
                  <td className="lbl" style={{letterSpacing:'2px'}}>대 표 이 사</td>
                </tr>
                <tr style={{height:'25mm'}}><td></td><td></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 차량운행상황 ── */}
        <table>
          <colgroup>
            <col style={{width:'9mm'}} />
            <col style={{width:'25mm'}} />
            <col style={{width:'29mm'}} />
            <col style={{width:'9mm'}} />
            <col style={{width:'10mm'}} />
            <col style={{width:'35mm'}} />
            <col />
            <col style={{width:'20mm'}} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan="8" className="sec">차 량 운 행 상 황</td>
            </tr>
            <tr className="h11">
              <td rowSpan="3" className="lbl vert">운행내역</td>
              <td className="lbl">운행시작</td>
              <td className="num" colSpan={2}>{startKm} km</td>
              <td rowSpan="3" className="lbl vert">연료내역</td>
              <td className="lbl">주&nbsp;&nbsp;유&nbsp;&nbsp;량</td>
              <td colSpan={2} style={{textAlign:'left', paddingLeft:'30px'}}>{r.fuel ? `${r.fuel} ℓ` : ''}</td>
            </tr>
            <tr className="h11">
              <td className="lbl">운행종료</td>
              <td className="num" colSpan={2}>{endKm} km</td>
              <td className="lbl">요&nbsp;&nbsp;소&nbsp;&nbsp;수</td>
              <td colSpan={2} style={{textAlign:'left', paddingLeft:'30px'}}>{r.urea ? `${r.urea} 개` : ''}</td>
            </tr>
            <tr className="h11">
              <td className="lbl">운행거리</td>
              <td className="num" colSpan={2}>{dist} km</td>
              <td className="lbl">기 &nbsp; &nbsp; &nbsp; 타</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        {/* ── 행선지 / 운행시간 / 내역 ── */}
        <table className="mt">
          <colgroup>
            <col style={{width:'34mm'}} />
            <col style={{width:'38mm'}} />
            <col />
          </colgroup>
          <tbody>
            <tr className="h9">
              <td className="lbl">행&nbsp;&nbsp;선&nbsp;&nbsp;지</td>
              <td className="lbl">운&nbsp;&nbsp;행&nbsp;&nbsp;시&nbsp;&nbsp;간</td>
              <td className="lbl">내&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;역</td>
            </tr>
            <tr className="h13">
              <td style={{textAlign:'center'}}>{area}</td>
              <td style={{textAlign:'center'}}>
                {r.op_start && r.op_end ? `${r.op_start} ~ ${r.op_end}` : '~'}
              </td>
              <td style={{paddingLeft:'8px'}}>{r.route || ''}</td>
            </tr>
            {[0,1,2].map(i => (
              <tr key={i} className="h13">
                <td></td>
                <td style={{textAlign:'center'}}>~</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── 작업인 / 작업내용 ── */}
        <table className="mt">
          <colgroup>
            <col style={{width:'34mm'}} />
            <col />
          </colgroup>
          <tbody>
            <tr className="h11">
              <td className="lbl">작&nbsp;&nbsp;업&nbsp;&nbsp;인</td>
              <td style={{textAlign:'left', paddingLeft:'10px'}}>{workerNames}</td>
            </tr>
            <tr className="h13">
              <td className="lbl" rowSpan="3">작업내용</td>
              <td style={{textAlign:'left', paddingLeft:'10px'}}>
                <span className={`cb${record ? ' cb-on' : ''}`}></span>음식물 수거
              </td>
            </tr>
            <tr className="h13">
              <td style={{textAlign:'left', paddingLeft:'10px'}}>
                <span className="cb"></span>민원 내용 :
              </td>
            </tr>
            <tr className="h13">
              <td style={{textAlign:'left', paddingLeft:'10px'}}>
                <span className="cb"></span>기&nbsp;&nbsp; &nbsp; &nbsp;타 : {r.notes || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── 계근량 / 칩수거현황 / 운행횟수 ── */}
        <table className="mt">
          <colgroup>
            <col style={{width:'24mm'}} />
            <col style={{width:'24mm'}} />
            <col style={{width:'24mm'}} />
            <col style={{width:'10mm'}} />
            <col style={{width:'13mm'}} />
            <col style={{width:'15mm'}} />
            <col style={{width:'8mm'}} />
            <col style={{width:'40mm'}} />
          </colgroup>
          <tbody>
            <tr className="h9">
              <td colSpan="3" className="sec">계&nbsp;&nbsp;근&nbsp;&nbsp;량</td>
              <td rowSpan="4" className="lbl vert" style={{fontSize:'9pt',letterSpacing:'2px'}}>칩수거현황</td>
              <td style={{fontSize:'9pt', textAlign:'right', paddingRight:'10px'}}>3ℓ</td>
              <td colSpan="2" style={{textAlign:'right', paddingRight:'10px'}}>{fmtChip(r.chip_3l)} 개</td>
              <td
                  rowSpan="4"
                  style={{
                    position:'relative',
                    padding:0,
                    textAlign:'center'
                  }}
                >
                  {/* 상단 영역 */}
                  <div
                    style={{
                      position:'absolute',
                      top:0,
                      left:0,
                      right:0,
                      height:'50%',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      flexDirection:'column',
                      fontWeight:'bold',
                      fontSize:'9.5pt',
                      lineHeight:'1.6'
                    }}
                  >
                    <div>운행 횟수</div>
                    <div>(환경사업소)</div>
                  </div>

                  {/* 가운데 선 */}
                  <div
                    style={{
                      position:'absolute',
                      left:0,
                      right:0,
                      top:'50%',
                      borderTop:'1px solid black'
                    }}
                  />

                  {/* 하단 영역 */}
                  <div
                    style={{
                      position:'absolute',
                      bottom:0,
                      left:0,
                      right:0,
                      height:'50%',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      fontSize:'14pt',
                      fontWeight:'bold'
                    }}
                  >
                    {r.trips ? `${r.trips} 회` : ''}
                  </div>
                </td>
            </tr>
            <tr className="h9">
              <td className="lbl">1 차</td>
              <td className="lbl">2 차</td>
              <td className="lbl">비&nbsp;&nbsp;고</td>
              <td style={{fontSize:'9pt', textAlign:'right', paddingRight:'10px'}}>5ℓ</td>
              <td colSpan="2" style={{textAlign:'right', paddingRight:'10px', borderRight:'1px solid black'}}>{fmtChip(r.chip_5l)} 개</td>
            </tr>
            <tr className="h15">
              <td rowSpan="2" style={{textAlign:'center',fontSize:'12pt',fontWeight:'bold',verticalAlign:'middle'}}>{w1}</td>
              <td rowSpan="2" style={{textAlign:'center',fontSize:'12pt',fontWeight:'bold',verticalAlign:'middle'}}>{w2}</td>
              <td rowSpan="2"></td>
              <td style={{fontSize:'9pt', textAlign:'right', paddingRight:'10px'}}>20ℓ</td>
              <td colSpan="2" style={{textAlign:'right', paddingRight:'10px', borderRight:'1px solid black'}}>{fmtChip(r.chip_20l)} 개</td>
            </tr>
            <tr className="h11">
              <td style={{fontSize:'9pt', textAlign:'right', paddingRight:'10px'}}>120ℓ</td>
              <td colSpan="2" style={{textAlign:'right', paddingRight:'10px', borderRight:'1px solid black'}}>{fmtChip(r.chip_120l)} 개</td>
            </tr>
          </tbody>
        </table>

        <div className="footer">{settings.company_name || '주식회사 진우환경'}</div>
      </div>
    </>
  );
}
