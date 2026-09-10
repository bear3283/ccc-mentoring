/**
 * 보유 기간이 지난 신청 데이터를 파기한다.
 *
 * 동의 문구에 "행사 종료 후 N일까지 보관하고 지체 없이 파기합니다" 라고
 * 적어 놓고 지우지 않으면 동의 위반이다. 행사가 끝나면 이 스크립트를 돌린다.
 *
 * 행사 종료일은 DB에 없으므로 인자로 받는다.
 *
 * 실행:
 *   npm run purge -- --event-end 2026-11-30           # 확인만
 *   npm run purge -- --event-end 2026-11-30 --yes     # 실제 파기
 */
import { RETENTION_DAYS } from "../src/shared/constants/privacy";
import { supabaseAccess } from "./lib/env";

const { url, headers } = supabaseAccess();

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

const eventEnd = arg("event-end");
const confirmed = process.argv.includes("--yes");

if (!eventEnd || !/^\d{4}-\d{2}-\d{2}$/.test(eventEnd)) {
  console.error("행사 종료일이 필요합니다.");
  console.error("  npm run purge -- --event-end 2026-11-30");
  process.exit(1);
}

const endDate = new Date(`${eventEnd}T23:59:59+09:00`);
if (Number.isNaN(endDate.getTime())) {
  console.error(`날짜를 해석하지 못했습니다: ${eventEnd}`);
  process.exit(1);
}

/** 행사 종료 + 보유 기간이 지나야 파기 대상이 된다. */
const purgeAfter = new Date(endDate.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

interface UserRow {
  participation_code: string;
  role: string;
  created_at: string;
}

async function main() {
  const now = new Date();

  console.log(`행사 종료일   ${eventEnd}`);
  console.log(`보유 기간     ${RETENTION_DAYS}일 (privacy.ts 의 RETENTION_DAYS)`);
  console.log(`파기 시점     ${purgeAfter.toISOString().slice(0, 10)} 이후`);
  console.log(`오늘          ${now.toISOString().slice(0, 10)}`);
  console.log("─".repeat(52));

  if (now < purgeAfter) {
    const daysLeft = Math.ceil((purgeAfter.getTime() - now.getTime()) / 86_400_000);
    console.log(`아직 보유 기간 중입니다. ${daysLeft}일 남았습니다.`);
    console.log("기간이 지나기 전에 지우려면 npm run reset-data 를 쓰세요.");
    return;
  }

  const res = await fetch(
    `${url}/rest/v1/users?select=participation_code,role,created_at`,
    { headers },
  );
  if (!res.ok) {
    console.error(`조회 실패: HTTP ${res.status}`);
    process.exit(1);
  }

  const rows = (await res.json()) as UserRow[];
  if (rows.length === 0) {
    console.log("파기할 데이터가 없습니다.");
    return;
  }

  const mentees = rows.filter((r) => r.role === "MENTEE").length;
  console.log(`파기 대상: ${rows.length}명 (멘티 ${mentees} / 멘토 ${rows.length - mentees})`);
  console.log("매칭 기록(matchings)은 외래키로 함께 삭제됩니다.");

  if (!confirmed) {
    console.log("\n확인만 했습니다. 실제로 파기하려면 --yes 를 붙이세요.");
    return;
  }

  const del = await fetch(`${url}/rest/v1/users?id=not.is.null`, { method: "DELETE", headers });
  if (!del.ok) {
    console.error(`파기 실패: HTTP ${del.status}`);
    process.exit(1);
  }

  const left = (await (await fetch(`${url}/rest/v1/users?select=id`, { headers })).json()) as unknown[];
  console.log(`\n파기 완료. 남은 행 ${left.length}`);
  console.log(`파기 일시: ${new Date().toISOString()}`);
  console.log("이 기록을 운영 문서에 남겨 두세요.");
}

void main();
