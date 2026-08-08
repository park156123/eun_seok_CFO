import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  logOut,
  isEmailAllowed,
  subscribeToAuth,
} from '../services/authService';
import { ensureHouseholdDocExists } from '../services/householdService';
import { Lock, LogOut, ShieldAlert } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email && isEmailAllowed(currentUser.email)) {
        ensureHouseholdDocExists(currentUser.email);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || '로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err: any) {
      console.error('Logout error', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-300 font-medium">인증 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  // Case 1: Unauthenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">우리집 CFO</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            가족 전용 자산 및 재무 관리 시스템입니다.<br />
            허용된 Google 계정으로 로그인해 주세요.
          </p>

          {errorMsg && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-left">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-900/30 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Authenticated but Email NOT Allowed
  if (!isEmailAllowed(user.email)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">접근 권한 제한</h1>
          <p className="text-slate-300 text-sm mb-4 leading-relaxed">
            <span className="font-semibold text-amber-300">{user.email}</span> 계정은 우리집 CFO 허용 목록(Allowlist)에 등록되어 있지 않습니다.
          </p>
          <div className="bg-slate-900/60 rounded-xl p-4 mb-6 border border-slate-700/50 text-xs text-slate-400 text-left">
            <p className="font-semibold text-slate-300 mb-1">안내:</p>
            <p>
              우리집 CFO는 허용된 가족 계정만 이용할 수 있습니다. 배우자 등 가구원 계정 등록이 필요하신 경우 환경변수(VITE_ALLOWED_EMAILS)에 이메일을 추가해야 합니다.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃 후 다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // Case 3: Authenticated AND Allowed
  return <>{children}</>;
}
