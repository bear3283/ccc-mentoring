import { readFileSync } from "node:fs";

/**
 * 스크립트에서 .env.local 을 읽는다.
 *
 * Next.js 밖에서 도는 스크립트라 process.env 에 자동으로 안 들어온다.
 * dotenv 를 넣는 대신 형식이 단순해 직접 읽는다.
 */
export function loadEnv(): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    console.error(".env.local 을 찾지 못했습니다. 프로젝트 루트에서 실행하세요.");
    process.exit(1);
  }

  return Object.fromEntries(
    raw
      .split("\n")
      .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}

export interface SupabaseAccess {
  url: string;
  headers: Record<string, string>;
}

export function supabaseAccess(): SupabaseAccess {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 있어야 합니다.");
    process.exit(1);
  }

  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}
