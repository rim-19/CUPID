/* Customer accounts, backed by the server. The cached user is read
   synchronously by the UI (so render code stays simple), while sign up / in /
   out talk to the auth API and the httpOnly session cookie keeps you signed in
   across reloads. init() asks the server who you are on boot. */

import { api } from './api';

export interface User {
  id?: string;
  name: string;
  email: string;
  verified?: boolean;
}
export interface AuthResult {
  ok: boolean;
  error?: string;
}
type Listener = () => void;

function createAccount() {
  let user: User | null = null;
  let ready = false;
  const listeners = new Set<Listener>();
  const emit = (): void => {
    listeners.forEach((l) => l());
  };

  const fail = (e: any, fallback: string): AuthResult => ({
    ok: false,
    error: (e && e.data && e.data.error) || (e && e.message) || fallback,
  });

  return {
    current: (): User | null => user,
    isSignedIn: (): boolean => Boolean(user),
    isReady: (): boolean => ready,
    /* Seed the cached user from a bootstrap payload (no extra request). */
    hydrate(next: User | null): void {
      user = next || null;
      ready = true;
      emit();
    },
    async init(): Promise<void> {
      try {
        const r = await api.get('/auth/me');
        user = (r && r.user) || null;
      } catch {
        user = null;
      }
      ready = true;
      emit();
    },
    async signUp(name: string, email: string, password: string): Promise<AuthResult> {
      try {
        const r = await api.post('/auth/signup', { name, email, password });
        user = r.user;
        emit();
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not create your account.');
      }
    },
    async signIn(email: string, password: string): Promise<AuthResult> {
      try {
        const r = await api.post('/auth/login', { email, password });
        user = r.user;
        emit();
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not sign you in.');
      }
    },
    async signOut(): Promise<void> {
      user = null;
      emit();
      try {
        await api.post('/auth/logout');
      } catch {
        /* already cleared locally */
      }
    },
    /* Re-fetch the current user (e.g. after verifying email in another tab). */
    async refresh(): Promise<void> {
      try {
        const r = await api.get('/auth/me');
        user = (r && r.user) || null;
      } catch {
        /* keep the cached user on a transient failure */
      }
      emit();
    },
    async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
      try {
        await api.post('/auth/change-password', { currentPassword, newPassword });
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not change your password.');
      }
    },
    async changeEmail(password: string, email: string): Promise<AuthResult> {
      try {
        const r = await api.post('/auth/change-email', { password, email });
        user = (r && r.user) || user;
        emit();
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not change your email.');
      }
    },
    async resendVerification(): Promise<AuthResult> {
      try {
        await api.post('/auth/resend-verification');
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not send the email.');
      }
    },
    async logoutEverywhere(): Promise<AuthResult> {
      try {
        await api.post('/auth/logout-all');
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not sign out your other sessions.');
      }
    },
    async deleteAccount(password: string): Promise<AuthResult> {
      try {
        await api.del('/auth/account', { password });
        user = null;
        emit();
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not delete your account.');
      }
    },
    async orders(): Promise<any[]> {
      try {
        const r = await api.get('/orders');
        return (r && r.orders) || [];
      } catch {
        return [];
      }
    },
    async downloads(): Promise<any[]> {
      try {
        const r = await api.get('/downloads');
        return (r && r.downloads) || [];
      } catch {
        return [];
      }
    },
    async verifyEmail(token: string): Promise<AuthResult> {
      try {
        const r = await api.post('/auth/verify', { token });
        if (r && r.user) {
          user = r.user;
          emit();
        }
        return { ok: true };
      } catch (e) {
        return fail(e, 'That confirmation link is invalid or has expired.');
      }
    },
    async requestReset(email: string): Promise<AuthResult> {
      try {
        await api.post('/auth/forgot', { email });
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not start the password reset.');
      }
    },
    async resetPassword(token: string, password: string): Promise<AuthResult> {
      try {
        await api.post('/auth/reset', { token, password });
        return { ok: true };
      } catch (e) {
        return fail(e, 'Could not reset your password.');
      }
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const account = createAccount();
export type AccountStore = ReturnType<typeof createAccount>;
