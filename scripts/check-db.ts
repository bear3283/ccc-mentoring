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

const ONE_TO_ONE_SQL = `create unique index if not exists matchings_mentor_taken_unique
  on public.matchings (mentor_id)
  where status in ('REQUESTED', 'CONFIRMED');

create unique index if not exists matchings_mentee_taken_unique
  on public.matchings (mentee_id)
  where status in ('REQUESTED', 'CONFIRMED');`;

/**
 * 1:1 제약을 확인한다.
 *
 * 코드에서도 "이미 매칭됐는지" 보지만, 두 멘티가 같은 순간에 누르면 둘 다
 * 통과한다. 마지막 방어선은 DB 인덱스뿐이라 여기서 살아있는지 확인한다.
 *
 * 실데이터를 건드리지 않도록 검사용 사용자를 새로 만들고 끝나면 지운다.
 */
async function probeOneToOne(): Promise<boolean> {
  const CHECK_CONTACT = "010-0000-9003";
  const base = {
    gender: "FEMALE" as const,
    persona_type: "DAVID",
    available_times: ["WEEKDAY_EVENING"],
    consented_at: new Date().toISOString(),
    consent_version: "check",
  };

  async function add(role: string, code: string, n: number): Promise<string> {
    const res = await fetch(`${url}/rest/v1/users`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        ...base,
        role,
        participation_code: code,
        name: `1대1확인${n}`,
        contact: `${CHECK_CONTACT}`.slice(0, -1) + n,
      }),
    });
    if (!res.ok) throw new Error(`검사용 ${role} 생성 실패 — ${await res.text()}`);
    const [row] = (await res.json()) as { id: string }[];
    return row.id;
  }

  async function link(menteeId: string, mentorId: string): Promise<Response> {
    return fetch(`${url}/rest/v1/matchings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mentee_id: menteeId,
        mentor_id: mentorId,
        score: 50,
        // breakdown 은 NOT NULL 이다. 빼면 제약과 무관하게 삽입이 실패한다.
        breakdown: {},
        rank: 1,
        status: "REQUESTED",
      }),
    });
  }

  const cleanup = () =>
    fetch(`${url}/rest/v1/users?contact=like.010-0000-900*`, { method: "DELETE", headers });

  await cleanup();
  try {
    // 참여코드는 0·1·I·L·O 를 뺀 알파벳만 쓴다. 그 밖의 글자를 넣으면
    // users_participation_code_check 에 걸려 검사 자체가 성립하지 않는다.
    const menteeA = await add("MENTEE", "CHKQTA", 4);
    const menteeB = await add("MENTEE", "CHKQTB", 5);
    const mentor = await add("MENTOR", "CHKQTC", 6);

    const first = await link(menteeA, mentor);
    if (!first.ok) throw new Error(`첫 매칭이 저장되지 않음 — ${await first.text()}`);

    // 같은 멘토를 다른 멘티가 가져가려 하면 거부되어야 한다.
    const second = await link(menteeB, mentor);
    return !second.ok;
  } finally {
    await cleanup();
  }
}

const EVENT_SQL = `alter table public.users
  add column if not exists church text,
  add column if not exists is_new_friend boolean not null default false,
  add column if not exists mentoring_applied boolean not null default false;

alter table public.users alter column persona_type drop not null;
alter table public.users alter column gender drop not null;

do $$ begin
  alter table public.users drop constraint users_available_times_check;
exception when undefined_object then null; end $$;

alter table public.users
  alter column available_times drop not null,
  alter column available_times set default '{}';`;

const PERSONA_SQL = `alter type persona_type add value if not exists 'NEHEMIAH';
alter type persona_type add value if not exists 'DANIEL';
alter type persona_type add value if not exists 'RUTH';
alter type persona_type add value if not exists 'DEBORAH';`;

/**
 * 넓힌 성경 인물이 DB enum 에도 들어갔는지 본다.
 *
 * 코드만 배포하고 SQL 을 잊으면, 새 유형을 고른 사람의 신청이 저장 단계에서
 * 통째로 실패한다. 화면에는 선택지가 멀쩡히 보이므로 원인을 찾기 어렵다.
 */
async function probeNewPersona(): Promise<boolean> {
  const res = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      role: "MENTEE",
      participation_code: "CHKPSA",
      name: "성향확인",
      gender: "FEMALE",
      contact: "010-0000-9007",
      persona_type: "DEBORAH",
      available_times: ["WEEKDAY_EVENING"],
      consented_at: new Date().toISOString(),
      consent_version: "check",
    }),
  });
  if (res.ok) {
    await fetch(`${url}/rest/v1/users?contact=eq.010-0000-9007`, {
      method: "DELETE",
      headers,
    });
    return true;
  }
  const body = await res.text();
  // enum 에 없는 값이면 22P02(invalid input value). 그 밖의 실패는 검사 오류다.
  if (body.includes("22P02") || body.includes("invalid input value")) return false;
  throw new Error(`검사용 행 생성 실패 — ${body}`);
}

const requirements: Requirement[] = [
  {
    name: "행사 등록 컬럼 (church, is_new_friend, mentoring_applied)",
    column: { table: "users", column: "church,is_new_friend,mentoring_applied" },
    sql: EVENT_SQL,
  },
  {
    name: "성경 인물 8종 (느헤미야·다니엘·룻·드보라)",
    requires: "행사 등록 컬럼 (church, is_new_friend, mentoring_applied)",
    probe: probeNewPersona,
    sql: PERSONA_SQL,
  },
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
  {
    name: "1:1 매칭 제약 (멘토·멘티 각 1명)",
    requires: "동의 컬럼 (consented_at, consent_version)",
    probe: probeOneToOne,
    sql: ONE_TO_ONE_SQL,
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

    // probe 가 준비 단계에서 터지면 "제약이 없다"와 구분되지 않는다.
    // 둘을 같이 취급하면 이미 적용된 SQL을 계속 실행하라고 안내하게 된다.
    let ok: boolean;
    try {
      ok = req.column
        ? await hasColumn(req.column.table, req.column.column)
        : await req.probe!();
    } catch (e) {
      console.log(`  ! ${req.name}  (검사 실패 — ${e instanceof Error ? e.message : e})`);
      console.log(`    이 결과는 제약의 유무를 뜻하지 않습니다. 검사 코드를 먼저 고치세요.`);
      missing.push(req);
      continue;
    }

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
