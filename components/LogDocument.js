import { Document, Page, Text, View, Font } from '@react-pdf/renderer';

const origin = typeof window !== 'undefined' ? window.location.origin : '';

Font.register({
  family: 'NanumGothic',
  fonts: [
    { src: `${origin}/fonts/NanumGothic-Regular.ttf`, fontWeight: 'normal' },
    { src: `${origin}/fonts/NanumGothic-Bold.ttf`, fontWeight: 'bold' },
  ],
});

const BW = 2;
const BC = '#000000';

const TW = { borderTopWidth: BW, borderTopColor: BC, borderLeftWidth: BW, borderLeftColor: BC };
const RB = { borderRightWidth: BW, borderRightColor: BC, borderBottomWidth: BW, borderBottomColor: BC };
const R  = { borderRightWidth: BW, borderRightColor: BC };
const B  = { borderBottomWidth: BW, borderBottomColor: BC };

const base = { justifyContent: 'center', padding: '1.5mm 2mm' };
const lbl  = { fontWeight: 'bold', textAlign: 'center' };
const num  = { textAlign: 'right' };

const DAYS = ['일','월','화','수','목','금','토'];

function fmtKm(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(3);
}
function fmtChip(v) { return v ? String(v) : ''; }

export default function LogDocument({ date, record, presentWorkers, settings }) {
  const d   = new Date(date);
  const dow = DAYS[d.getDay()];
  const ymd = `${d.getFullYear()}.  ${d.getMonth() + 1}.  ${d.getDate()}.`;

  const r  = record || {};
  const startKm     = fmtKm(r.start_km);
  const endKm       = fmtKm(r.end_km);
  const dist        = (r.start_km != null && r.end_km != null)
    ? fmtKm(Number(r.end_km) - Number(r.start_km)) : '';
  const w1          = r.weight_1 ? Number(r.weight_1).toFixed(3) : '';
  const w2          = r.weight_2 ? Number(r.weight_2).toFixed(3) : '';
  const workerNames = presentWorkers.map(w => w.name).join(', ');
  const area        = r.route ? r.route.split('(')[0].split(' ')[0] + ' ~' : '';
  const vehicleNum  = r.vehicle_number || settings.vehicle_number || '';
  const driver      = r.driver || settings.driver || '';
  const company     = settings.company_name || '주식회사 진우환경';
  const timeStr     = r.op_start && r.op_end ? `${r.op_start} ~ ${r.op_end}` : '~';

  const pageStyle = {
    fontFamily: 'NanumGothic',
    padding: '20mm 11mm 9mm 11mm',
    fontSize: 10,
    color: '#000',
    backgroundColor: '#fff',
  };

  return (
    <Document>
      <Page size="A4" style={pageStyle}>

        {/* 제목 */}
        <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', letterSpacing: 3, marginBottom: '7mm' }}>
          차 량 운 행 일 지 ( 작 업 일 지 )
        </Text>

        {/* 상단: 날짜/차량/운전자 + 결재 */}
        <View style={{ flexDirection: 'row', marginBottom: '4mm' }}>

          <View style={{ width: '110mm', marginRight: '12mm', ...TW }}>
            <View style={{ flexDirection: 'row', height: '12mm' }}>
              <View style={{ flex: 1, ...RB, ...base }}><Text>{ymd}</Text></View>
              <View style={{ width: '51mm', ...RB, ...base, ...lbl }}><Text>요 일 : {dow}</Text></View>
            </View>
            <View style={{ flexDirection: 'row', height: '12mm' }}>
              <View style={{ flex: 1, ...RB, ...base, ...lbl }}><Text>차 량 번 호</Text></View>
              <View style={{ width: '51mm', ...RB, ...base }}><Text>{vehicleNum}</Text></View>
            </View>
            <View style={{ flexDirection: 'row', height: '12mm' }}>
              <View style={{ flex: 1, ...RB, ...base, ...lbl }}><Text>운  전  자</Text></View>
              <View style={{ width: '51mm', ...RB, ...base }}><Text>{driver}</Text></View>
            </View>
          </View>

          <View style={{ flex: 1, ...TW, flexDirection: 'row' }}>
            <View style={{ width: '10mm', ...R, ...B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 10, letterSpacing: 2 }}>
                결{'\n'}재
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ flex: 1, ...RB, ...base, ...lbl }}><Text>담  당</Text></View>
                <View style={{ flex: 1, ...RB, ...base, ...lbl }}><Text>대 표 이 사</Text></View>
              </View>
              <View style={{ flexDirection: 'row', height: '25mm' }}>
                <View style={{ flex: 1, ...RB, ...base }}><Text></Text></View>
                <View style={{ flex: 1, ...RB, ...base }}><Text></Text></View>
              </View>
            </View>
          </View>
        </View>

        {/* 차량운행상황 */}
        <View style={{ ...TW }}>
          <View style={{ ...RB, ...base, height: '9mm', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, letterSpacing: 3 }}>차 량 운 행 상 황</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {/* 운행내역 수직 라벨 */}
            <View style={{ width: '9mm', ...R, ...B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 9, letterSpacing: 2 }}>
                운{'\n'}행{'\n'}내{'\n'}역
              </Text>
            </View>
            {/* 운행시작/종료/거리 */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '17mm', ...RB, ...base, ...lbl }}><Text>운행시작</Text></View>
                <View style={{ flex: 1, ...RB, ...base, ...num }}><Text>{startKm} km</Text></View>
              </View>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '17mm', ...RB, ...base, ...lbl }}><Text>운행종료</Text></View>
                <View style={{ flex: 1, ...RB, ...base, ...num }}><Text>{endKm} km</Text></View>
              </View>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '17mm', ...RB, ...base, ...lbl }}><Text>운행거리</Text></View>
                <View style={{ flex: 1, ...RB, ...base, ...num }}><Text>{dist} km</Text></View>
              </View>
            </View>
            {/* 연료내역 수직 라벨 */}
            <View style={{ width: '9mm', ...R, ...B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 9, letterSpacing: 2 }}>
                연{'\n'}료{'\n'}내{'\n'}역
              </Text>
            </View>
            {/* 주유량/요소수/기타 */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '21mm', ...RB, ...base, ...lbl }}><Text>주  유  량</Text></View>
                <View style={{ flex: 1, ...RB, ...base }}><Text style={{ paddingLeft: 10 }}>{r.fuel ? `${r.fuel} ℓ` : ''}</Text></View>
              </View>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '21mm', ...RB, ...base, ...lbl }}><Text>요  소  수</Text></View>
                <View style={{ flex: 1, ...RB, ...base }}><Text style={{ paddingLeft: 10 }}>{r.urea ? `${r.urea} 개` : ''}</Text></View>
              </View>
              <View style={{ flexDirection: 'row', height: '11mm' }}>
                <View style={{ width: '21mm', ...RB, ...base, ...lbl }}><Text>기  타</Text></View>
                <View style={{ flex: 1, ...RB, ...base }}><Text></Text></View>
              </View>
            </View>
          </View>
        </View>

        {/* 행선지 / 운행시간 / 내역 */}
        <View style={{ ...TW, marginTop: '3mm' }}>
          <View style={{ flexDirection: 'row', height: '9mm' }}>
            <View style={{ width: '34mm', ...RB, ...base, ...lbl }}><Text>행  선  지</Text></View>
            <View style={{ width: '38mm', ...RB, ...base, ...lbl }}><Text>운  행  시  간</Text></View>
            <View style={{ flex: 1,       ...RB, ...base, ...lbl }}><Text>내           역</Text></View>
          </View>
          <View style={{ flexDirection: 'row', height: '13mm' }}>
            <View style={{ width: '34mm', ...RB, ...base }}><Text style={{ textAlign: 'center' }}>{area}</Text></View>
            <View style={{ width: '38mm', ...RB, ...base }}><Text style={{ textAlign: 'center' }}>{timeStr}</Text></View>
            <View style={{ flex: 1,       ...RB, ...base }}><Text style={{ paddingLeft: 8 }}>{r.route || ''}</Text></View>
          </View>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flexDirection: 'row', height: '13mm' }}>
              <View style={{ width: '34mm', ...RB, ...base }}><Text></Text></View>
              <View style={{ width: '38mm', ...RB, ...base }}><Text style={{ textAlign: 'center' }}>~</Text></View>
              <View style={{ flex: 1,       ...RB, ...base }}><Text></Text></View>
            </View>
          ))}
        </View>

        {/* 작업인 / 작업내용 */}
        <View style={{ ...TW, marginTop: '3mm' }}>
          <View style={{ flexDirection: 'row', height: '11mm' }}>
            <View style={{ width: '34mm', ...RB, ...base, ...lbl }}><Text>작  업  인</Text></View>
            <View style={{ flex: 1, ...RB, ...base }}><Text style={{ paddingLeft: 10 }}>{workerNames}</Text></View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: '34mm', ...R, ...B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center' }}>작업내용</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ ...RB, ...base, height: '13mm' }}>
                <Text>  {record ? '☑' : '☐'} 음식물 수거</Text>
              </View>
              <View style={{ ...RB, ...base, height: '13mm' }}>
                <Text>  ☐ 민원 내용:</Text>
              </View>
              <View style={{ ...RB, ...base, height: '13mm' }}>
                <Text>  ☐ 기   타: {r.notes || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 계근량 / 칩수거현황 / 운행횟수 */}
        <View style={{ ...TW, marginTop: '3mm' }}>
          <View style={{ flexDirection: 'row' }}>

            {/* 계근량 블록 */}
            <View style={{ width: '72mm' }}>
              {/* 계근량 헤더 */}
              <View style={{ ...RB, ...base, height: '9mm', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 11, letterSpacing: 3 }}>계  근  량</Text>
              </View>
              {/* 1차/2차/비고 헤더 */}
              <View style={{ flexDirection: 'row', height: '9mm' }}>
                <View style={{ width: '24mm', ...RB, ...base, ...lbl }}><Text>1 차</Text></View>
                <View style={{ width: '24mm', ...RB, ...base, ...lbl }}><Text>2 차</Text></View>
                <View style={{ width: '24mm', ...RB, ...base, ...lbl }}><Text>비  고</Text></View>
              </View>
              {/* 값 (h15 + h11 병합) */}
              <View style={{ flexDirection: 'row', height: '26mm' }}>
                <View style={{ width: '24mm', ...RB, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{w1}</Text>
                </View>
                <View style={{ width: '24mm', ...RB, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{w2}</Text>
                </View>
                <View style={{ width: '24mm', ...RB, ...base }}><Text></Text></View>
              </View>
            </View>

            {/* 칩수거현황 수직 라벨 */}
            <View style={{ width: '9mm', ...R, ...B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 8, letterSpacing: 2 }}>
                칩{'\n'}수{'\n'}거{'\n'}현{'\n'}황
              </Text>
            </View>

            {/* 칩 데이터 (라벨 + 값+개 병합) */}
            <View style={{ width: '28mm' }}>
              {[
                { label: '3ℓ',   val: r.chip_3l,   h: '9mm'  },
                { label: '5ℓ',   val: r.chip_5l,   h: '9mm'  },
                { label: '20ℓ',  val: r.chip_20l,  h: '15mm' },
                { label: '120ℓ', val: r.chip_120l, h: '11mm' },
              ].map(({ label, val, h }) => (
                <View key={label} style={{ flexDirection: 'row', height: h }}>
                  <View style={{ width: '10mm', ...RB, ...base, ...lbl }}>
                    <Text style={{ fontSize: 9 }}>{label}</Text>
                  </View>
                  <View style={{ flex: 1, ...RB, ...base, ...num }}>
                    <Text>{fmtChip(val)} 개</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* 운행횟수 */}
            <View style={{ flex: 1, ...RB, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 9.5, lineHeight: 1.6 }}>
                운행 횟수{'\n'}(환경사업소)
              </Text>
              {r.trips ? (
                <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 14, marginTop: '3mm' }}>
                  {r.trips} 회
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* 푸터 */}
        <Text style={{ textAlign: 'right', fontSize: 10, fontWeight: 'bold', marginTop: '4mm' }}>
          {company}
        </Text>

      </Page>
    </Document>
  );
}
