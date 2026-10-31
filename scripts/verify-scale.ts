/**
 * 대량 검증. 멘토·멘티 2,000명씩을 넣고 운영자 화면과 매칭이 빠짐없이 도는지 본다.
 *
 * Supabase 는 한 번에 1,000행까지만 돌려주고 넘치면 알리지 않고 자른다.
 * 행이 적으면 이 문제는 드러나지 않아 실제로 넣어 봐야 한다.
 *
 * .env.local 의 DB 를 쓴다. 오픈 후에는 돌리지 마세요 — 시험용 선배가 실제 후배에게
 * 추천될 수 있다. 그래서 시험 외 신청이 한 건이라도 있으면 시작하지 않는다.
 * 끝나거나 중단되면 시험용 번호(010-0098-*)만 지운다.
 *
 * 실행:
 *   npm run build && npm start            # 다른 터미널에서
 *   npm run verify:scale
 */
import { loadEnv, supabaseAccess } from "./lib/env";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const COUNT = 2000;
const REQUESTED = 1100;
const CONCURRENT = 30;
const TEST_PATTERN = "010-0098-*";

const { url, headers } = supabaseAccess();

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** 사진 한 장이 평균 60KB 라고 잡는다. 목록 응답에 섞이면 크기에서 바로 드러난다. */
const PHOTO = `data:image/jpeg;base64,${"A".repeat(60_000)}`;

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Z 로 시작하는 차례 코드. 시험 안에서 겹치지 않는다. */
function code(n: number): string {
  let out = "";
  let rest = n;
  for (let i = 0; i < 5; i++) {
    out = ALPHABET[rest % ALPHABET.length] + out;
    rest = Math.floor(rest / ALPHABET.length);
  }
  return `Z${out}`;
}

function contact(n: number): string {
  return `010-0098-${String(n).padStart(4, "0")}`;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} ${res.status} ${await res.text()}`);
  return res;
}

/** 프로필 표는 id 가 없어 users·matchings 에만 쓴다. */
async function countAll(table: string, filter = ""): Promise<number> {
  const res = await rest(`${table}?select=id${filter ? `&${filter}` : ""}&limit=1`, {
    headers: { Prefer: "count=exact" },
  });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? "NaN");
}

async function insertBatched(table: string, rows: unknown[], batch: number): Promise<{ id: string }[]> {
  const created: { id: string }[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    const res = await rest(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(rows.slice(i, i + batch)),
    });
    if (table === "users") {
      created.push(...((await res.json()) as { id: string }[]).map((r) => ({ id: r.id })));
    }
  }
  return created;
}

async function cleanup(): Promise<number> {
  await fetch(`${url}/rest/v1/users?contact=like.${TEST_PATTERN}`, { method: "DELETE", headers });
  return countAll("users", `contact=like.${TEST_PATTERN}`);
}

function userRow(role: "MENTOR" | "MENTEE", n: number) {
  return {
    role,
    participation_code: code(n),
    name: `대량${role === "MENTOR" ? "선배" : "후배"}${n}`,
    gender: "FEMALE",
    contact: contact(n),
    mentoring_applied: true,
    mbti: "INTJ",
    photo_url: role === "MENTOR" ? PHOTO : null,
    consented_at: new Date().toISOString(),
    consent_version: "scale-test",
  };
}

async function timed<T>(run: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await run();
  return { value, ms: Date.now() - start };
}

function post(path: string, body: unknown, cookie?: string) {
  return fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

/** RSC 데이터 안에서 항목 수를 센다. 따옴표가 이스케이프되어 있다. */
function matches(html: string, key: string, value = '[^\\\\"]*'): string[] {
  return html.match(new RegExp(`\\\\"${key}\\\\":\\\\"${value}\\\\"`, "g")) ?? [];
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

async function loadAdmin(cookie: string) {
  const { value, ms } = await timed(async () => {
    const res = await fetch(`${BASE}/admin`, { headers: { Cookie: cookie } });
    return { status: res.status, html: await res.text() };
  });
  return { ...value, ms, bytes: Buffer.byteLength(value.html) };
}

async function main() {
  console.log(`대량 검증  ${BASE}  (멘토 ${COUNT} / 멘티 ${COUNT})`);

  const others = (await countAll("users")) - (await countAll("users", `contact=like.${TEST_PATTERN}`));
  if (others > 0) {
    console.error(`시험 외 신청이 ${others}건 있어 시작하지 않습니다. 시험용 선배가 실제 후배에게 추천될 수 있습니다.`);
    process.exit(1);
  }
  await cleanup();

  const password = loadEnv().ADMIN_PASSWORD;
  const login = await post("/api/admin/login", { password });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!login.ok || !cookie) throw new Error(`운영자 로그인 실패: HTTP ${login.status}`);

  console.log("\n[1] 데이터 넣기");
  const seeded = await timed(async () => {
    const mentors = await insertBatched(
      "users",
      Array.from({ length: COUNT }, (_, i) => userRow("MENTOR", i + 1)),
      200,
    );
    const mentees = await insertBatched(
      "users",
      Array.from({ length: COUNT }, (_, i) => userRow("MENTEE", COUNT + i + 1)),
      500,
    );
    await insertBatched(
      "mentor_profiles",
      mentors.map((m) => ({
        user_id: m.id,
        current_campus: "연세대",
        admission_year: 2023,
        mentoring_area: ["학점관리"],
        current_majors: ["경영학과"],
        career_paths: [],
        capacity: 2,
        verified_at: new Date().toISOString(),
      })),
      500,
    );
    await insertBatched(
      "mentee_profiles",
      mentees.map((m) => ({
        user_id: m.id,
        target_campus: ["연세대"],
        desired_areas: ["학점관리"],
        target_majors: ["경영학과"],
        target_careers: [],
      })),
      500,
    );
    await insertBatched(
      "matchings",
      Array.from({ length: REQUESTED }, (_, i) => ({
        mentee_id: mentees[i].id,
        mentor_id: mentors[i].id,
        score: 50,
        breakdown: {},
        rank: 1,
        status: "REQUESTED",
      })),
      500,
    );
  });
  console.log(`  ${(seeded.ms / 1000).toFixed(1)}초`);

  console.log("\n[2] 운영자 화면 — 1,000행에서 잘리지 않는가");
  const before = await loadAdmin(cookie);
  check("화면이 열림", before.status === 200, `HTTP ${before.status}, ${(before.ms / 1000).toFixed(1)}초, ${mb(before.bytes)}`);
  const allCodes = new Set(matches(before.html, "participationCode", "Z[A-Z0-9]{5}"));
  check("멘토·멘티 전원 표시", allCodes.size === COUNT * 2, `${allCodes.size}명`);
  check(
    "배정 상태 전원 반영",
    (before.html.match(/\\"assigned\\":1/g) ?? []).length === REQUESTED,
    `${(before.html.match(/\\"assigned\\":1/g) ?? []).length}명`,
  );
  check("선배 알림 목록 전원", matches(before.html, "matchingId").length === REQUESTED, `${matches(before.html, "matchingId").length}건`);
  check("사진이 응답에 없음", !before.html.includes("data:image/jpeg"));

  console.log("\n[3] 전체 매칭 실행");
  const run = await timed(async () => {
    const res = await post("/api/admin/match-all", {}, cookie);
    return { status: res.status, json: (await res.json()) as Record<string, number> };
  });
  check("완료", run.value.status === 200, `HTTP ${run.value.status}, ${(run.ms / 1000).toFixed(1)}초 (Vercel 한도 300초)`);
  check("대상 전원", run.value.json.applicants === COUNT, String(run.value.json.applicants));
  check("확정된 멘티는 건드리지 않음", run.value.json.settled === REQUESTED, String(run.value.json.settled));
  check("나머지 전원 계산", run.value.json.computed === COUNT - REQUESTED, String(run.value.json.computed));

  const stored = await countAll("matchings");
  const after = await loadAdmin(cookie);
  const matchRows = matches(after.html, "menteeCode", "Z[A-Z0-9]{5}");
  check("저장된 매칭이 1,000행을 넘음", stored > 1000, `${stored}행`);
  check("매칭 표 전체 표시", matchRows.length === stored, `${matchRows.length}행`);
  check("매칭 후 운영자 화면", after.status === 200, `${(after.ms / 1000).toFixed(1)}초, ${mb(after.bytes)}`);

  console.log("\n[4] 참가자 요청");
  const open = await timed(() => post("/api/match", { participationCode: code(COUNT + REQUESTED + 1) }));
  const openJson = (await open.value.json()) as { results?: { mentor: { photoUrl?: string } }[] };
  const openBytes = JSON.stringify(openJson).length;
  check(
    "후보 3명과 사진",
    openJson.results?.length === 3 && openJson.results.every((r) => r.mentor.photoUrl === PHOTO),
    `${open.ms}ms, ${mb(openBytes)}`,
  );
  const settled = await post("/api/match", { participationCode: code(COUNT + 1) });
  const settledJson = (await settled.json()) as { results?: { mentor: { photoUrl?: string } }[] };
  check("확정 멘티는 자기 선배와 사진", settledJson.results?.length === 1 && settledJson.results[0].mentor.photoUrl === PHOTO);

  const concurrent = await timed(() =>
    Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        timed(async () => {
          const res = await post("/api/match", { participationCode: code(COUNT + REQUESTED + 1 + i) });
          await res.text();
          return res.status;
        }),
      ),
    ),
  );
  const times = concurrent.value.map((r) => r.ms).sort((a, b) => a - b);
  check(
    `결과 조회 ${CONCURRENT}건 동시`,
    concurrent.value.every((r) => r.value === 200),
    `중앙값 ${times[times.length >> 1]}ms, 최대 ${times[times.length - 1]}ms`,
  );

  const signups = await timed(() =>
    Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        timed(async () => {
          const res = await post("/api/signup", {
            role: "MENTEE",
            draft: {
              targetCampus: [],
              desiredAreas: [],
              targetMajors: [],
              name: `동시등록${i}`,
              gender: "FEMALE",
              contact: contact(6000 + i),
              consentedAt: new Date().toISOString(),
              consentVersion: (await import("../src/shared/constants/privacy")).CONSENT_VERSION,
            },
          });
          await res.text();
          return res.status;
        }),
      ),
    ),
  );
  const signupTimes = signups.value.map((r) => r.ms).sort((a, b) => a - b);
  check(
    `신규 등록 ${CONCURRENT}건 동시`,
    signups.value.every((r) => r.value === 200),
    `중앙값 ${signupTimes[signupTimes.length >> 1]}ms, 최대 ${signupTimes[signupTimes.length - 1]}ms`,
  );
}

let cleaning = false;
async function finish(code: number): Promise<never> {
  if (!cleaning) {
    cleaning = true;
    console.log("\n[정리]");
    const left = await cleanup();
    const total = await countAll("users");
    const matchingsLeft = await countAll("matchings");
    check("시험 데이터 삭제", left === 0 && total === 0 && matchingsLeft === 0, `users ${total}행, matchings ${matchingsLeft}행`);
  }
  console.log(failed === 0 && code === 0 ? "\n대량 검증 통과" : `\n실패 ${failed}건`);
  process.exit(failed === 0 ? code : 1);
}

process.on("SIGINT", () => void finish(130));
process.on("SIGTERM", () => void finish(143));

main()
  .then(() => finish(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    return finish(1);
  });
