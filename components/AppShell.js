'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import OnboardingModal from './OnboardingModal';

const AppContext = createContext(null);

export function useAppShell() {
  return useContext(AppContext);
}

const hiddenNav = new Set(['/login', '/register', '/reset-password']);

async function loadAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { user: null, account: null, error: '' };
  const response = await fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } });
  const result = await response.json();
  if (!response.ok) return { user: session.user, account: null, error: result.error || 'Your profile could not be loaded.' };
  return { user: session.user, account: result, error: '' };
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const menuRef = useRef(null);
  const avatarRef = useRef(null);

  const refreshProfile = useCallback(async () => {
    const next = await loadAccount();
    setUser(next.user);
    setAccount(next.account);
    setProfileError(next.error);
    return next.account;
  }, []);

  useEffect(() => {
    let ignore = false;
    loadAccount().then(next => {
      if (ignore) return;
      setUser(next.user);
      setAccount(next.account);
      setProfileError(next.error);
      setReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAccount(null);
        const path = window.location.pathname;
        if (path !== '/login' && path !== '/register' && path !== '/reset-password') router.replace('/login');
        return;
      }
      setTimeout(() => refreshProfile(), 0);
    });
    return () => {
      ignore = true;
      subscription.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!ready || hiddenNav.has(pathname)) return;
    if (account?.profile?.onboarding_status === 'pending') setOnboardingOpen(true);
  }, [ready, account, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const items = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    items()[0]?.focus();
    function onPointer(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        avatarRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const nodes = items();
      const index = nodes.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
      nodes[next]?.focus();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    setAccount(null);
    router.replace('/login');
  }

  const profile = account?.profile || null;
  const role = profile?.role || 'learner';
  const showNav = !hiddenNav.has(pathname);
  const email = account?.email || user?.email || '';
  const name = profile?.full_name?.trim() || user?.user_metadata?.full_name?.trim() || email.split('@')[0] || 'Account';
  const initials = name.split(/\s+/).slice(0, 2).map(part => (part.match(/\p{L}|\p{N}/u) || [''])[0].toUpperCase()).join('') || 'A';

  const value = {
    user,
    profile,
    email,
    role,
    goals: account?.goals || [],
    categoryIds: account?.categoryIds || [],
    profileError,
    refreshProfile,
    ready,
  };

  function navClass(href) {
    const active = href === '/exercises'
      ? pathname === '/exercises' || pathname.startsWith('/exercise/')
      : pathname === href || pathname.startsWith(`${href}/`);
    return active ? 'active' : '';
  }

  return (
    <AppContext.Provider value={value}>
      {showNav && (
        <header className="site-header">
          <Link className="site-brand" href="/exercises">FluentPal</Link>
          <nav id="site-nav" aria-label="Main">
            <Link className={navClass('/exercises')} href="/exercises" aria-current={navClass('/exercises') ? 'page' : undefined}>Exercises</Link>
            {user && <Link className={navClass(role === 'admin' ? '/admin' : '/profile')} href={role === 'admin' ? '/admin' : '/profile'} aria-current={navClass(role === 'admin' ? '/admin' : '/profile') ? 'page' : undefined}>Progress</Link>}
          </nav>
          <div className="header-tools">
            {role === 'admin' && <Link className="ghost-button" href="/add">Add exercise</Link>}
            <div className="user-menu" ref={menuRef}>
              {user ? (
                <>
                  <button ref={avatarRef} type="button" className="user-avatar" aria-label={`Account menu for ${name}`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="account-menu" onClick={() => setMenuOpen(open => !open)}>
                    {initials}
                  </button>
                  {menuOpen && (
                    <div id="account-menu" className="user-menu-panel" role="menu" aria-label="Account">
                      <div className="user-menu-identity">
                        <strong>{name}</strong>
                        {email && <span className="secondary-email">{email}</span>}
                      </div>
                      <Link href="/profile" role="menuitem">Profile</Link>
                      <Link href="/settings" role="menuitem">Settings</Link>
                      <button type="button" role="menuitem" onClick={signOut}>Sign out</button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Link className="ghost-button" href="/login">Log in</Link>
                  <Link className="ghost-button" href="/register">Register</Link>
                </>
              )}
            </div>
          </div>
        </header>
      )}
      {showNav && profileError && (
        <p className="notice notice-error shell-notice" role="alert">
          {profileError} <button type="button" className="text-button" onClick={refreshProfile}>Retry</button>
        </p>
      )}
      {children}
      <OnboardingModal
        open={showNav && onboardingOpen && Boolean(user)}
        initial={{ english_level: profile?.english_level || '', goals: account?.goals || [], categoryIds: account?.categoryIds || [] }}
        onClose={() => setOnboardingOpen(false)}
        onSaved={refreshProfile}
      />
    </AppContext.Provider>
  );
}
