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
        background: '#1e40af',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'NanumGothic',
      }}
    >
      <div style={{ fontSize: '40px', color: '#93c5fd', marginBottom: '20px' }}>♻</div>
      <div style={{ fontSize: '100px', fontWeight: 'bold', color: '#ffffff', marginBottom: '24px' }}>
        진우환경
      </div>
      <div style={{ fontSize: '56px', color: '#bfdbfe' }}>
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
