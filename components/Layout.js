import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children, role }) {
  const router  = useRouter();
  const isAdmin = role === 'admin';
  const active  = (path) => router.pathname.startsWith(path) ? 'active' : '';

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href={isAdmin ? '/' : '/daily'} className="nav-logo">
            <img src="/logo.svg" alt="진우환경" style={{height:'36px', filter:'brightness(0) invert(1)'}} />
          </Link>
          <div className="nav-links">
            <Link href="/daily" className={active('/daily')}>일일 입력</Link>
            {isAdmin && <>
              <Link href="/history" className={active('/history')}>월별 조회</Link>
              <Link href="/expenses" className={active('/expenses')}>비용 관리</Link>
              <Link href="/workers" className={active('/workers')}>작업자</Link>
              <Link href="/contracts" className={active('/contracts')}>계약</Link>
              <Link href="/settings" className={active('/settings')}>설정</Link>
            </>}
            <button
              onClick={handleLogout}
              style={{background:'none',border:'1px solid #cbd5e1',borderRadius:'6px',
                      padding:'4px 10px',cursor:'pointer',fontSize:'13px',color:'#64748b'}}
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
