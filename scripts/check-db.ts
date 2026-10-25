/**
 * DB 스키마가 코드와 맞는지 확인한다.
 *
 * 스키마 변경은 SQL Editor에서 사람이 실행해야 해서, 코드만 배포하고
 * SQL을 잊으면 신청이 통째로 실패한다. 배포 전에 이걸 먼저 돌린다.
 *
 * 실행: npm run check:db
 */
import { readFileSync } from "node:fs";
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

/**
 * 정원 마이그레이션 SQL. 길어서 여기 옮겨 적지 않고 파일을 그대로 보여준다.
 * 옮겨 적으면 파일만 고치고 여기는 옛 SQL로 남는다.
 */
const CAPACITY_SQL = readFileSync(
  new URL("../supabase/migrations/2026-10-19-mentor-capacity.sql", import.meta.url),
  "utf8",
).trim();

const ARRIVAL_SQL = readFileSync(
  new URL("../supabase/migrations/2026-10-20-event-arrival.sql", import.meta.url),
  "utf8",
).trim();

const NO_SCHEDULE_SQL = readFileSync(
  new URL("../supabase/migrations/2026-10-25-no-schedule.sql", import.meta.url),
  "utf8",
).trim();

const CONTACT_UNIQUE_SQL = readFileSync(
  new URL("../supabase/migrations/2026-10-25-contact-unique.sql", import.meta.url),
  "utf8",
).trim();

const NOTICE_SQL = readFileSync(
  new URL("../supabase/migrations/2026-10-20-mentor-notice.sql", import.meta.url),
  "utf8",
).trim();

/**
 * 매칭 정원을 확인한다. 멘토는 고른 정원만큼, 멘티는 한 명만.
 *
 * 코드에서도 자리가 남았는지 세지만, 마지막 한 자리에 두 멘티가 같은 순간에
 * 누르면 둘 다 통과한다. 마지막 방어선은 DB 트리거·인덱스뿐이라 여기서
 * 살아있는지 확인한다.
 *
 * 실데이터를 건드리지 않도록 검사용 사용자를 새로 만들고 끝나면 지운다.
 */
async function probeCapacity(): Promise<boolean> {
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
        name: `정원확인${n}`,
        contact: `010-0000-900${n}`,
      }),
    });
    if (!res.ok) throw new Error(`검사용 ${role} 생성 실패 — ${await res.text()}`);
    const [row] = (await res.json()) as { id: string }[];
    return row.id;
  }

  /** 정원은 프로필에 있다. 프로필이 없으면 트리거가 1명으로 본다. */
  async function addMentor(code: string, n: number, capacity: number): Promise<string> {
    const id = await add("MENTOR", code, n);
    const res = await fetch(`${url}/rest/v1/mentor_profiles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: id,
        current_campus: "연세대",
        admission_year: 2023,
        mentoring_area: ["학점관리"],
        current_majors: ["경영학과"],
        career_paths: ["금융권"],
        capacity,
      }),
    });
    if (!res.ok) throw new Error(`검사용 멘토 프로필 생성 실패 — ${await res.text()}`);
    return id;
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
    const menteeA = await add("MENTEE", "CHKCPA", 3);
    const menteeB = await add("MENTEE", "CHKCPB", 4);
    const menteeC = await add("MENTEE", "CHKCPC", 5);
    const mentorOfTwo = await addMentor("CHKCPD", 6, 2);
    const otherMentor = await addMentor("CHKCPE", 8, 3);

    // 정원 2명: 두 명까지는 받아야 한다. 옛 1:1 인덱스가 남아 있으면 둘째에서 막힌다.
    const first = await link(menteeA, mentorOfTwo);
    if (!first.ok) throw new Error(`첫 매칭이 저장되지 않음 — ${await first.text()}`);
    const second = await link(menteeB, mentorOfTwo);
    if (!second.ok) return false;

    // 세 번째는 거부되어야 한다.
    const third = await link(menteeC, mentorOfTwo);
    if (third.ok) return false;

    // 멘티는 여전히 한 명만 고른다. 자리가 남은 다른 멘토라도 거부되어야 한다.
    const menteeTwice = await link(menteeA, otherMentor);
    return !menteeTwice.ok;
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
    // 역할이 달라도 같은 번호는 하나만. 코드도 막지만 동시에 들어온 두 요청은 DB만 막는다.
    name: "같은 번호 중복 방지 (역할 무관, users_contact_digits_unique)",
    requires: "연락처+역할 중복 방지 제약",
    probe: async () => {
      const base = {
        name: "번호확인",
        gender: "FEMALE",
        contact: "010-0000-9011",
        persona_type: "DAVID",
        consented_at: new Date().toISOString(),
        consent_version: "check",
      };
      const first = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...base, role: "MENTEE", participation_code: "CHKCUA" }),
      });
      if (!first.ok) throw new Error(`검사용 행 생성 실패 — ${await first.text()}`);
      const second = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...base, role: "MENTOR", participation_code: "CHKCUB" }),
      });
      await fetch(`${url}/rest/v1/users?contact=eq.010-0000-9011`, { method: "DELETE", headers });
      return !second.ok;
    },
    sql: CONTACT_UNIQUE_SQL,
  },
  {
    name: "채플 당일 도착 시간 컬럼 (users.event_arrival)",
    column: { table: "users", column: "event_arrival" },
    sql: ARRIVAL_SQL,
  },
  {
    name: "도착 시간은 정해진 값만 저장",
    requires: "채플 당일 도착 시간 컬럼 (users.event_arrival)",
    probe: () =>
      insertRejected({
        role: "MENTEE",
        participation_code: "CHKARA",
        name: "도착확인",
        gender: "FEMALE",
        contact: "010-0000-9009",
        persona_type: "DAVID",
        available_times: ["WEEKDAY_EVENING"],
        consented_at: new Date().toISOString(),
        consent_version: "check",
        // 목록에 없는 값을 넣어 거부되는지 본다
        event_arrival: "2500",
      }),
    sql: ARRIVAL_SQL,
  },
  {
    // 코드는 더 이상 시간대를 보내지 않는다. 옛 제약이 남아 있으면 멘토링 신청이 전부 실패한다.
    name: "멘토링 신청에 시간대 불필요 (users_mentoring_fields_required 완화)",
    requires: "행사 등록 컬럼 (church, is_new_friend, mentoring_applied)",
    probe: async () => {
      const res = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          role: "MENTEE",
          participation_code: "CHKNSA",
          name: "시간확인",
          gender: "FEMALE",
          contact: "010-0000-9010",
          persona_type: "DAVID",
          mentoring_applied: true,
          available_times: [],
          consented_at: new Date().toISOString(),
          consent_version: "check",
        }),
      });
      if (res.ok) {
        await fetch(`${url}/rest/v1/users?contact=eq.010-0000-9010`, { method: "DELETE", headers });
        return true;
      }
      const body = await res.text();
      // 23514 = check 제약 위반. 그 밖의 실패는 검사 오류다.
      if (body.includes("23514")) return false;
      throw new Error(`검사용 행 생성 실패 — ${body}`);
    },
    sql: NO_SCHEDULE_SQL,
  },
  {
    name: "선배 알림 기록 컬럼 (matchings.mentor_notified_at, mentor_notified_via)",
    column: { table: "matchings", column: "mentor_notified_at,mentor_notified_via" },
    sql: NOTICE_SQL,
  },
  {
    name: "멘토 정원 컬럼 (mentor_profiles.capacity)",
    column: { table: "mentor_profiles", column: "capacity" },
    sql: CAPACITY_SQL,
  },
  {
    name: "매칭 정원 제약 (멘토는 정원만큼, 멘티는 1명)",
    requires: "멘토 정원 컬럼 (mentor_profiles.capacity)",
    probe: probeCapacity,
    sql: CAPACITY_SQL,
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
