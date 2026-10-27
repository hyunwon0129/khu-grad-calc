// 회원 탈퇴: 요청한 본인 계정을 삭제한다. grad_progress 행은 on delete cascade로 함께 지워진다.
// 배포: supabase functions deploy delete-account
// 브라우저에는 service_role 키를 절대 넣지 않는다. 이 함수 안에서만 서버 환경변수로 쓴다.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// 허용할 앱 주소 (쉼표 구분). 예: supabase secrets set ALLOWED_ORIGINS=https://nungnungkyunghee.netlify.app
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function corsFor(origin: string | null) {
  const ok = origin && (allowed.length === 0 || allowed.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('Origin'));
  if (allowed.length && !allowed.includes(req.headers.get('Origin') ?? '')) {
    return new Response('Forbidden origin', { status: 403, headers: cors });
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 요청자의 토큰으로 본인 확인
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error } = await asUser.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401, headers: cors });

  const admin = createClient(url, service);
  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) return new Response('삭제하지 못했습니다', { status: 500, headers: cors }); // 내부 오류 문구는 밖으로 내보내지 않는다

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
