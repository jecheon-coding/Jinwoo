import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const fontUrl = new URL('/fonts/NanumGothic-Bold.ttf', req.url).href;
  const fontData = await fetch(fontUrl).then(r => r.arrayBuffer());

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: '#1e3a8a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'NanumGothic',
        gap: '24px',
      }}
    >
      {/* JW 심볼 + 회사명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '140px', fontWeight: '900', color: '#93c5fd', lineHeight: 1 }}>J</span>
          <span style={{ fontSize: '140px', fontWeight: '900', color: '#fca5a5', lineHeight: 1 }}>W</span>
        </div>
        <div style={{ width: '3px', height: '120px', background: 'rgba(255,255,255,0.3)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '72px', fontWeight: 'bold', color: '#ffffff' }}>(주)진우환경</span>
          <span style={{ fontSize: '36px', color: '#bfdbfe' }}>사업장폐기물 수집·운반</span>
        </div>
      </div>
      <div style={{ fontSize: '40px', color: '#93c5fd', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '24px', width: '80%', textAlign: 'center' }}>
        일일 작업일지
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'NanumGothic', data: fontData, weight: 700 }],
    }
  );
}
