import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getRole } from '../lib/auth';

Home.noLayout = true;

export async function getServerSideProps({ req }) {
  const role = getRole(req);
  // 로그인된 사용자는 서버에서 바로 이동
  if (role) {
    const today = new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(new Date());
    return { redirect: { destination: `/daily/${today}`, permanent: false } };
  }
  // 비로그인: OG 태그가 있는 페이지 렌더링 (카카오 봇이 읽음)
  return { props: {} };
}

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace('/login'); }, []);

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', color:'#9ca3af' }}>
        로딩 중...
      </div>
    </>
  );
}
