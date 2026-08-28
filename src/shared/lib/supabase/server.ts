import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트.
 *
 * service_role 키를 쓰므로 RLS를 우회한다. 이 파일은 절대 클라이언트 번들에
 * 들어가면 안 된다 - API Route와 서버 컴포넌트에서만 import 할 것.
 *
 * 환경변수가 없으면 null을 돌려준다. 그래야 자격증명 없이도 앱이 더미
 * 데이터로 그대로 돌아가고, 키만 채우면 실서버로 전환된다.
 */

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    cached = null;
    return cached;
  }

  cached = createClient(url, serviceKey, {
    auth: {
      // 서버에서 도는 코드라 세션을 유지하거나 갱신할 필요가 없다.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}

/** 자격증명이 채워져 실제 DB에 붙는 상태인지. 화면에 안내를 띄울 때 쓴다. */
export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
