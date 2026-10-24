// 로그인·동기화 (Supabase). 환경변수가 없으면 비활성화되고 앱은 로컬 전용으로 동작한다.
// 서버로 보내는 것은 storage.ts의 UserData(학수번호·학기·설정)뿐이다.
// 사정표 파일·이름·학번은 서버로 보내지 않는다.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { sanitize, type UserData } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type Provider = 'kakao' | 'google';
export const providers: Provider[] = String(import.meta.env.VITE_AUTH_PROVIDERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Provider => s === 'kakao' || s === 'google');

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } })
    : null;

export const cloudEnabled = supabase !== null;

const TABLE = 'grad_progress';

/** 로그인 후 돌아올 주소 (현재 페이지) */
const redirectTo = () => window.location.origin + window.location.pathname;

export async function signInWithEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signInWithProvider(provider: Provider): Promise<void> {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.');
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export function onSession(cb: (s: Session | null) => void): () => void {
  if (!supabase) return () => {};
  supabase.auth.getSession().then(({ data }) => cb(data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, s) => cb(s));
  return () => data.subscription.unsubscribe();
}

export async function fetchCloud(): Promise<UserData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select('data').maybeSingle();
  if (error) throw error;
  return data ? sanitize(data.data as UserData) : null;
}

export async function pushCloud(userId: string, d: UserData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: sanitize(d), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** 서버에 저장된 내 데이터 행 삭제 */
export async function deleteCloud(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().not('user_id', 'is', null);
  if (error) throw error;
}

/** 계정 자체 삭제 (서버의 delete-account 함수 호출). 데이터 행도 함께 지워진다. */
export async function deleteAccount(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
}
