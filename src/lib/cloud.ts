// 로그인·동기화 (Supabase). 환경변수가 없으면 비활성화되고 앱은 로컬 전용으로 동작한다.
// 서버로 보내는 것은 storage.ts의 UserData(학수번호·학기·설정)뿐이다.
// 사정표 파일·이름·학번은 서버로 보내지 않는다.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getNoSave, sanitize, type UserData } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type Provider = 'kakao' | 'google';
export const providers: Provider[] = String(import.meta.env.VITE_AUTH_PROVIDERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Provider => s === 'kakao' || s === 'google');

/** 서버에 실제로 켜진 소셜 로그인 (Supabase 설정을 읽어 확인). 환경변수에 적은 것과 합친다 */
export async function enabledProviders(): Promise<Provider[]> {
  if (!url || !anonKey) return providers;
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!r.ok) return providers;
    const j = await r.json() as { external?: Record<string, boolean> };
    const on = (['google', 'kakao'] as Provider[]).filter((p) => j.external?.[p]);
    return [...new Set([...on])];
  } catch {
    return providers;
  }
}

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true, detectSessionInUrl: true, flowType: 'pkce',
          // 공용 PC 모드면 로그인 정보도 탭을 닫을 때 사라지게 sessionStorage에 둔다
          ...(getNoSave() && typeof sessionStorage !== 'undefined' ? { storage: sessionStorage } : {}),
        },
      })
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

// RLS가 본인 행만 돌려주지만, 혹시 정책이 잘못 설정돼도 남의 행을 건드리지 않게 user_id로 한 번 더 거른다
export async function fetchCloud(userId: string): Promise<UserData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle();
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
export async function deleteCloud(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}

/** 계정 자체 삭제 (서버의 delete-account 함수 호출). 데이터 행도 함께 지워진다. */
export async function deleteAccount(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
}

/** 이 기기의 기록이 어느 계정 것인지 (다른 사람이 같은 기기에서 로그인할 때 남의 기록이 올라가지 않게) */
const OWNER_KEY = 'khu-grad-calc:owner';
export function getLocalOwner(): string | null {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
}
export function setLocalOwner(id: string | null): void {
  try { if (id) localStorage.setItem(OWNER_KEY, id); else localStorage.removeItem(OWNER_KEY); } catch { /* 무시 */ }
}

/** 서버 오류를 한국어 안내로 (원문에 토큰 등이 섞여도 화면에 그대로 내보내지 않는다) */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/rate limit|too many|429/i.test(m)) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요.';
  if (/invalid.*email|email.*invalid/i.test(m)) return '이메일 주소를 확인해 주세요.';
  if (/fetch|network|Failed to/i.test(m)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.';
  if (/JWT|token|session/i.test(m)) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  return '처리하지 못했습니다. 잠시 후 다시 시도하세요.';
}
