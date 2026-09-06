import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../features/auth/SessionProvider';

export function Layout() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    document.querySelector<HTMLElement>('main')?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  async function logout() {
    setSigningOut(true); setError('');
    try { await session.signOut(); navigate('/login'); }
    catch (err) { setError((err as Error).message); }
    finally { setSigningOut(false); }
  }
  return <>
    <a className="skip-link" href="#main">跳到主要內容</a>
    <header className="site-header"><Link className="brand" to="/">FurFriend <span>Finder</span></Link>
      <nav aria-label="主要導覽">
        <NavLink to="/quick-use">快速比對</NavLink><NavLink to="/shelter-animals">收容動物</NavLink>
        {session.user ? <><NavLink to="/profile">我的協尋</NavLink><button disabled={signingOut} onClick={logout}>登出</button></> : <NavLink to="/login">登入</NavLink>}
      </nav>
    </header>
    <main id="main" tabIndex={-1}>{error && <p role="alert" className="notice error">{error}</p>}<Outlet /></main>
    <footer><p>FurFriend Finder · 讓每一條線索，更接近回家的路。</p><p>配對結果是協尋線索，請向收容單位確認身分與最新狀態。</p></footer>
  </>;
}
