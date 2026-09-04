/**
 * 신청 데이터 전체 삭제.
 *
 * 리허설이 끝난 뒤 테스트 신청을 지우는 용도다.
 * 실수로 운영 중에 돌리면 되돌릴 수 없으므로 두 단계로 막는다.
 *   1) 지울 내용을 먼저 보여주고
 *   2) --yes 를 붙여야 실제로 지운다
 *
 * 실행:
 *   npx tsx scripts/reset-data.ts          # 무엇이 지워질지 확인만
 *   npx tsx scripts/reset-data.ts --yes    # 실제 삭제
 */
import { readFileSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(".env.local", "utf8");
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

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 있어야 합니다.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const confirmed = process.argv.includes("--yes");

interface UserRow {
  participation_code: string;
  role: string;
  name: string;
  created_at: string;
}

async function main() {
  const res = await fetch(
    `${url}/rest/v1/users?select=participation_code,role,name,created_at&order=created_at.desc`,
    { headers },
  );

  if (!res.ok) {
    console.error(`조회 실패: HTTP ${res.status}`);
    process.exit(1);
  }

  const rows = (await res.json()) as UserRow[];

  if (rows.length === 0) {
    console.log("지울 데이터가 없습니다. (users 0행)");
    return;
  }

  const mentees = rows.filter((r) => r.role === "MENTEE").length;
  const mentors = rows.length - mentees;

  console.log(`삭제 대상: 총 ${rows.length}명 (멘티 ${mentees} / 멘토 ${mentors})`);
  console.log("─".repeat(56));
  for (const row of rows.slice(0, 15)) {
    const when = new Date(row.created_at).toLocaleString("ko-KR");
    console.log(`  ${row.participation_code}  ${row.role.padEnd(6)} ${row.name.padEnd(6)} ${when}`);
  }
  if (rows.length > 15) console.log(`  ... 외 ${rows.length - 15}명`);
  console.log("─".repeat(56));
  console.log("매칭 기록(matchings)은 외래키로 함께 삭제됩니다.");

  if (!confirmed) {
    console.log("\n확인만 했습니다. 실제로 지우려면 --yes 를 붙이세요:");
    console.log("  npx tsx scripts/reset-data.ts --yes");
    return;
  }

  const del = await fetch(`${url}/rest/v1/users?id=not.is.null`, { method: "DELETE", headers });
  if (!del.ok) {
    console.error(`삭제 실패: HTTP ${del.status}`);
    process.exit(1);
  }

  const after = (await (await fetch(`${url}/rest/v1/users?select=id`, { headers })).json()) as unknown[];
  const matchings = (await (
    await fetch(`${url}/rest/v1/matchings?select=id`, { headers })
  ).json()) as unknown[];

  console.log(`\n삭제 완료. users ${after.length}행 / matchings ${matchings.length}행`);
}

void main();
