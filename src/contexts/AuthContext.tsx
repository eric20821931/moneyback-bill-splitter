import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { UserProfile } from '@/types';

type ApiRequest = <T = any>(action: string, payload?: Record<string, unknown>) => Promise<T>;

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  request: ApiRequest;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  request: async () => {
    throw new Error('Auth context is not ready');
  },
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const request = useCallback<ApiRequest>(async (action, payload = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('unauthorized');
    }

    const response = await fetch('/api/app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'request_failed');
    }
    return data;
  }, [getToken]);

  const refreshProfile = useCallback(async () => {
    if (!clerkUser) {
      setProfile(null);
      return;
    }

    const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
    const displayName = clerkUser.fullName || clerkUser.username || primaryEmail || 'Anonymous User';
    const language = window.localStorage.getItem('moneyback_language') || 'en';
    const theme = window.localStorage.getItem('moneyback_theme') || 'light';
    const data = await request<{ profile: UserProfile }>('profile.sync', {
      displayName,
      email: primaryEmail,
      photoURL: clerkUser.imageUrl || '',
      language,
      theme,
    });
    setProfile(data.profile);
  }, [clerkUser, request]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isLoaded) return;
      if (!isSignedIn || !clerkUser) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        await refreshProfile();
      } catch (error) {
        console.error('Failed to sync profile:', error);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, clerkUser, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        user: isSignedIn && clerkUser ? { uid: clerkUser.id } : null,
        profile,
        loading: !isLoaded || profileLoading,
        request,
        refreshProfile,
        signOut: async () => signOut(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
