import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
  const router = useRouter();
  const active = (path) => router.pathname.startsWith(path) ? 'active' : '';

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">♻ 음식물 수거 관리</Link>
          <div className="nav-links">
            <Link href="/daily" className={active('/daily')}>일일 입력</Link>
            <Link href="/history" className={active('/history')}>월별 조회</Link>
            <Link href="/workers" className={active('/workers')}>작업자</Link>
            <Link href="/settings" className={active('/settings')}>설정</Link>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
