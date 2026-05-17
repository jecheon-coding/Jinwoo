import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
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
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: '32px', color: '#93c5fd', marginBottom: '24px' }}>♻</div>
      <div style={{ fontSize: '88px', fontWeight: 'bold', color: '#ffffff', marginBottom: '20px' }}>
        진우환경
      </div>
      <div style={{ fontSize: '52px', color: '#bfdbfe' }}>
        일일 작업일지
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
