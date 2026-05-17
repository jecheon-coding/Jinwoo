import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { getRole } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const role = getRole(req);
  if (role === 'admin') return { redirect: { destination: '/', permanent: false } };
  if (role === 'user')  return { redirect: { destination: '/daily', permanent: false } };
  return { props: {} };
}

LoginPage.noLayout = true;

export default function LoginPage() {
  const router  = useRouter();
  const [pw, setPw]       = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || '오류가 발생했습니다.');
      return;
    }
    if (data.role === 'admin') router.push('/');
    else router.push('/daily');
  };

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '맑은 고딕','Malgun Gothic',sans-serif; background: #f0f9ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); padding: 40px 36px; width: 100%; max-width: 360px; }
    .logo { text-align: center; margin-bottom: 28px; }
    .logo p { font-size: 13px; color: #6b7280; margin-top: 2px; letter-spacing: 1px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 12px 14px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 15px; outline: none; transition: border-color .2s; }
    input[type=password]:focus { border-color: #2563eb; }
    .btn { width: 100%; padding: 13px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 16px; letter-spacing: 1px; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 13px; margin-top: 10px; text-align: center; }
  `;

  return (
    <>
      <Head>
        <title>진우환경 일일 작업일지</title>
        <meta property="og:title" content="진우환경 일일 작업일지" />
        <meta property="og:description" content="진우환경 음식물 수거 관리 시스템" />
        <meta property="og:image" content="https://jinwoo-amber.vercel.app/api/og" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://jinwoo-amber.vercel.app" />
        <meta property="og:type" content="website" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="card">
        <div className="logo">
          <img src="/logo.svg" alt="진우환경 로고" style={{width:'210px', marginBottom:'10px'}} />
          <p>일일 작업일지</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="비밀번호 입력"
            autoFocus
          />
          {error && <div className="error">{error}</div>}
          <button className="btn" type="submit" disabled={loading || !pw}>
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </>
  );
}
