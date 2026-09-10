/**
 * DB 스키마가 코드와 맞는지 확인한다.
 *
 * 스키마 변경은 SQL Editor에서 사람이 실행해야 해서, 코드만 배포하고
 * SQL을 잊으면 신청이 통째로 실패한다. 배포 전에 이걸 먼저 돌린다.
 *
 * 실행: npm run check:db
 */
import { supabaseAccess } from "./lib/env";

const { url, headers } = supabaseAccess();

interface Requirement {
  name: string;
  /** 이 컬럼이 있어야 한다 */
  column?: { table: string; column: string };
  /** 이 제약이 걸려 있어야 한다 (위반 데이터를 넣어 확인) */
  probe?: () => Promise<boolean>;
  /** 없을 때 실행해야 할 SQL */
  sql: string;
  /**
   * 이 항목이 통과해야 검사할 수 있다.
   * 예: 컬럼이 없으면 그 컬럼의 제약은 확인 자체가 불가능하다.
   * 선행 조건 없이 검사하면 "컬럼이 없어서 거부됨"을 "제약이 살아있음"으로 오해한다.
   */
  requires?: string;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, { headers });
  return res.ok;
}

/**
 * 제약을 확인하려고 일부러 위반 행을 넣어 본다. 거부되면 제약이 살아 있는 것.
 *
 * 주의: 확인하려는 제약 말고 다른 제약에 걸리면 안 된다.
 * 참여코드는 0,O,1,I,L 을 뺀 알파벳만 허용하므로 테스트 코드도 그 규칙을 지켜야 한다.
 */
async function insertRejected(row: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  if (res.ok) {
    // 들어가 버렸으면 치우고 실패로 본다.
    const [created] = (await res.json()) as { id: string }[];
    await fetch(`${url}/rest/v1/users?id=eq.${created.id}`, { method: "DELETE", headers });
    return false;
  }
  return true;
}

const CONSENT_SQL = `alter table public.users
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

do $$ begin
  alter table public.users
    add constraint users_consent_required
    check (consented_at is not null and consent_version is not null);
exception when duplicate_object then null; end $$;`;

const UNIQUE_SQL = `do $$ begin
  alter table public.users
    add constraint users_contact_role_unique unique (contact, role);
exception when duplicate_object then null; end $$;`;

const requirements: Requirement[] = [
  {
    name: "동의 컬럼 (consented_at, consent_version)",
    column: { table: "users", column: "consented_at,consent_version" },
    sql: CONSENT_SQL,
  },
  {
    name: "동의 없이는 저장 불가 제약",
    requires: "동의 컬럼 (consented_at, consent_version)",
    probe: () =>
      insertRejected({
        role: "MENTEE",
        participation_code: "CHKCNA",
        name: "제약확인",
        gender: "FEMALE",
        contact: "010-0000-9001",
        persona_type: "DAVID",
        available_times: ["WEEKDAY_EVENING"],
        // consented_at 을 일부러 빼서 거부되는지 본다
      }),
    sql: CONSENT_SQL,
  },
  {
    name: "연락처+역할 중복 방지 제약",
    requires: "동의 컬럼 (consented_at, consent_version)",
    probe: async () => {
      const base = {
        role: "MENTEE",
        name: "중복확인",
        gender: "FEMALE",
        contact: "010-0000-9002",
        persona_type: "DAVID",
        available_times: ["WEEKDAY_EVENING"],
        consented_at: new Date().toISOString(),
        consent_version: "check",
      };
      const first = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ ...base, participation_code: "CHKDPA" }),
      });
      if (!first.ok) return false; // 동의 제약이 없으면 여기서 이미 실패

      const [created] = (await first.json()) as { id: string }[];
      const second = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...base, participation_code: "CHKDPB" }),
      });
      const rejected = !second.ok;

      await fetch(`${url}/rest/v1/users?contact=eq.010-0000-9002`, {
        method: "DELETE",
        headers,
      });
      return rejected;
    },
    sql: UNIQUE_SQL,
  },
];

async function main() {
  console.log("DB 스키마 점검\n" + "─".repeat(52));

  const missing: Requirement[] = [];
  const passed = new Set<string>();

  for (const req of requirements) {
    if (req.requires && !passed.has(req.requires)) {
      // 선행 조건이 없으면 검사 결과를 신뢰할 수 없다.
      console.log(`  · ${req.name}  (건너뜀 — "${req.requires}" 먼저 필요)`);
      missing.push(req);
      continue;
    }

    const ok = req.column
      ? await hasColumn(req.column.table, req.column.column)
      : await req.probe!();

    console.log(`  ${ok ? "✓" : "✗"} ${req.name}`);
    if (ok) passed.add(req.name);
    else missing.push(req);
  }

  if (missing.length === 0) {
    console.log("─".repeat(52));
    console.log("스키마가 코드와 일치합니다.");
    return;
  }

  console.log("─".repeat(52));
  console.log(`\n${missing.length}건이 적용되지 않았습니다.`);
  console.log("Supabase → SQL Editor 에 아래를 붙여넣고 Run 하세요:\n");

  // 같은 SQL이 여러 항목에 걸릴 수 있으므로 중복을 없앤다.
  for (const sql of [...new Set(missing.map((m) => m.sql))]) {
    console.log(sql + "\n");
  }

  process.exit(1);
}

void main();
