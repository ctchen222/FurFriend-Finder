import { useEffect, useState } from 'react';
import {
    Link,
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import { useSession } from '../features/auth/SessionProvider';

export function Layout() {
    const session = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [error, setError] = useState('');
    const [signingOut, setSigningOut] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const isAuth = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
    ].includes(location.pathname);
    useEffect(() => {
        document.querySelector<HTMLElement>('main')?.focus();
        window.scrollTo(0, 0);
        setMenuOpen(false);
    }, [location.pathname]);
    async function logout() {
        setSigningOut(true);
        setError('');
        try {
            await session.signOut();
            navigate('/login');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSigningOut(false);
        }
    }
    return (
        <>
            <a className="skip-link" href="#main">
                跳到主要內容
            </a>
            {!isAuth && (
                <header className="main-header">
                    <div className="header-container">
                        <Link
                            className="logo"
                            to="/"
                            aria-label="FurFriend Finder 首頁"
                        >
                            <span className="logo-mark" aria-hidden="true">
                                FF
                            </span>
                            <span>FurFriend Finder</span>
                        </Link>
                        <button
                            className="nav-toggle"
                            aria-label="切換選單"
                            aria-expanded={menuOpen}
                            aria-controls="main-navigation"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            <span />
                            <span />
                            <span />
                        </button>
                        <nav
                            id="main-navigation"
                            className={`main-nav${menuOpen ? ' open' : ''}`}
                            aria-label="主要導覽"
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setMenuOpen(false);
                                    document
                                        .querySelector<HTMLButtonElement>(
                                            '.nav-toggle',
                                        )
                                        ?.focus();
                                }
                            }}
                        >
                            <NavLink to="/" end>
                                首頁
                            </NavLink>
                            <NavLink to="/shelter-animals">收容所動物</NavLink>
                            <NavLink to="/quick-use">快速比對</NavLink>
                            <NavLink to="/report-lost">協尋登記</NavLink>
                            {session.user ? (
                                <>
                                    <NavLink to="/profile">個人資料</NavLink>
                                    <button
                                        disabled={signingOut}
                                        onClick={logout}
                                    >
                                        登出
                                    </button>
                                </>
                            ) : (
                                <NavLink to="/login">登入</NavLink>
                            )}
                        </nav>
                    </div>
                </header>
            )}
            <main
                id="main"
                className={
                    isAuth
                        ? 'auth-layout'
                        : location.pathname === '/'
                          ? 'home-page'
                          : 'app-content'
                }
                tabIndex={-1}
            >
                {error && (
                    <p role="alert" className="notice error">
                        {error}
                    </p>
                )}
                <Outlet />
            </main>
            {!isAuth && (
                <footer className="main-footer">
                    <div className="footer-container">
                        <p className="footer-logo">FurFriend Finder</p>
                        <p className="footer-tagline">
                            整合台灣公開收容資料，協助飼主更快找到可能的線索。
                        </p>
                        <nav className="footer-nav" aria-label="頁腳導覽">
                            <Link to="/shelter-animals">收容所動物</Link>
                            <Link to="/quick-use">快速比對</Link>
                            <Link to="/report-lost">協尋登記</Link>
                        </nav>
                        <p className="footer-copy">
                            © 2024 FurFriend Finder · Taiwan shelter-data
                            matching platform
                        </p>
                    </div>
                </footer>
            )}
        </>
    );
}
