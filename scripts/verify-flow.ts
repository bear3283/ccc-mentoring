/**
 * 실제 서버를 상대로 전체 흐름을 검증한다.
 *
 * verify-matching.ts 는 점수 계산만 본다(서버 불필요).
 * 이 스크립트는 API·DB·보안이 실제로 맞물려 도는지 확인한다.
 *
 * 실행:
 *   npm run build && npm start     # 다른 터미널에서
 *   npm run verify:flow
 *
 * 검증이 끝나면 만든 데이터를 스스로 지운다.
 */
import { CONSENT_VERSION } from "../src/shared/constants/privacy";
import { loadEnv, supabaseAccess } from "./lib/env";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { url: dbUrl, headers: dbHeaders } = supabaseAccess();

/** 이 스크립트가 만든 데이터만 지우기 위한 표식. */
const TEST_PREFIX = "010-0099-";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* HTML 응답일 수 있다 */
  }
  return { status: res.status, json, res };
}

const consent = { consentedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION };
const empty = {
  targetCampus: [],
  desiredAreas: [],
  targetMajors: [],
  targetCareers: [],
  mentoringArea: [],
  currentMajors: [],
  careerPaths: [],
};

/** 1단계 — 고3채플 등록에 필요한 것만. 캠퍼스는 2단계로 옮겼다. */
function mentor(n: number, over: Record<string, unknown> = {}) {
  return {
    ...empty,
    ...consent,
    name: `검증멘토${n}`,
    contact: `${TEST_PREFIX}${String(1000 + n).slice(-4)}`,
    church: "신길교회",
    isNewFriend: false,
    ...over,
  };
}

/** 2단계 — 멘토링 신청 항목. 등록 페이로드 위에 덮어 쓴다. */
function mentorMentoring(over: Record<string, unknown> = {}) {
  return {
    ...empty,
    personaType: "SOLOMON",
    mbti: "INTJ",
    currentCampus: "연세대",
    admissionYear: 2023,
    mentoringArea: ["학점관리"],
    currentMajors: ["경영학과"],
    careerPaths: ["금융권"],
    availableTimes: ["WEEKDAY_EVENING"],
    eventArrival: "1830",
    ...over,
  };
}

function mentee(over: Record<string, unknown> = {}) {
  return {
    ...empty,
    ...consent,
    name: "검증멘티",
    contact: `${TEST_PREFIX}0001`,
    church: "신길교회",
    isNewFriend: false,
    ...over,
  };
}

function menteeMentoring(over: Record<string, unknown> = {}) {
  return {
    ...empty,
    personaType: "ESTHER",
    mbti: "ENFP",
    targetCampus: ["연세대"],
    desiredAreas: ["학점관리"],
    targetMajors: ["경영학과"],
    targetCareers: ["금융권"],
    availableTimes: ["WEEKDAY_EVENING"],
    eventArrival: "1800",
    ...over,
  };
}

/**
 * 등록과 멘토링 신청을 한 번에. 매칭 대상 멘티가 필요할 때 쓴다.
 *
 * 등록 저장은 IP당 10분 단위로 제한된다(/api/signup). 검증을 연달아 돌려도 한도에
 * 닿지 않도록 새로 등록하는 멘티 수를 늘리지 말고, 이미 등록한 멘티는
 * applyAsMentee 로 재사용한다. 실패하면 조용히 넘어가지 않고 이유를 드러낸다 —
 * 그렇지 않으면 "후보 0명"처럼 엉뚱한 검사가 실패한 것으로 보인다.
 */
async function registerAndApply(
  name: string,
  suffix: string,
  over: Record<string, unknown> = {},
): Promise<string | undefined> {
  const reg = await post("/api/signup", {
    role: "MENTEE",
    draft: mentee({ name, contact: `${TEST_PREFIX}${suffix}` }),
  });
  const code = reg.json.participationCode as string | undefined;
  if (!code) {
    check(`${name} 등록`, false, `HTTP ${reg.status} ${String(reg.json.error ?? "")}`);
    return undefined;
  }
  return applyAsMentee(name, code, over);
}

async function applyAsMentee(
  name: string,
  code: string | undefined,
  over: Record<string, unknown> = {},
): Promise<string | undefined> {
  const res = await post("/api/mentoring", {
    role: "MENTEE",
    draft: menteeMentoring(over),
    participationCode: code,
  });
  if (res.status !== 200) {
    check(`${name} 멘토링 신청`, false, `HTTP ${res.status} ${String(res.json.error ?? "")}`);
  }
  return code;
}

async function cleanup() {
  await fetch(`${dbUrl}/rest/v1/users?contact=like.${TEST_PREFIX}*`, {
    method: "DELETE",
    headers: dbHeaders,
  });
}

async function main() {
  console.log("=".repeat(56));
  console.log(`전체 흐름 검증  ${BASE}`);
  console.log("=".repeat(56));

  // 서버가 떠 있는지 먼저 본다. 없으면 이후 검사가 전부 의미 없다.
  try {
    const ping = await fetch(BASE, { redirect: "manual" });
    if (!ping.ok) throw new Error(String(ping.status));
  } catch {
    console.error(`\n서버에 연결하지 못했습니다: ${BASE}`);
    console.error("먼저 실행하세요:  npm run build && npm start");
    process.exit(1);
  }

  await cleanup();

  console.log("\n[1] 행사 등록 (1단계)");
  // 짧은 간격으로 다시 돌리면 속도 제한에 걸린다. 원인을 헷갈리지 않게 먼저 알린다.
  const probe = await post("/api/signup", { role: "MENTEE", draft: { name: "x" } });
  if (probe.status === 429) {
    console.error("\n속도 제한에 걸렸습니다. 직전 검증에서 소모한 몫이 남아 있습니다.");
    console.error("서버를 다시 시작하면 초기화됩니다 (제한은 메모리에만 기록됩니다).");
    process.exit(1);
  }
  const m1 = await post("/api/signup", { role: "MENTOR", draft: mentor(1) });
  check("멘토 등록", m1.status === 200 && typeof m1.json.participationCode === "string",
    String(m1.json.participationCode ?? m1.json.error));
  const m1Code = m1.json.participationCode as string | undefined;
  const menteeRes = await post("/api/signup", { role: "MENTEE", draft: mentee() });
  const menteeCode = menteeRes.json.participationCode as string | undefined;
  check("멘티 등록", menteeRes.status === 200 && !!menteeCode, String(menteeCode ?? menteeRes.json.error));

  console.log("\n[1-1] 멘토링 신청 (2단계)");
  // 등록만 한 사람은 매칭 대상이 아니어야 한다.
  const beforeApply = await post("/api/match", { participationCode: menteeCode });
  check(
    "등록만 한 멘티는 매칭 거부 (409)",
    beforeApply.status === 409 && beforeApply.json.needsMentoring === true,
    `HTTP ${beforeApply.status}`,
  );

  // 정원을 2명으로 받아, 두 번째 후배까지 연결되고 세 번째에서 막히는지 아래에서 본다.
  const mentorApply = await post("/api/mentoring", {
    role: "MENTOR",
    draft: mentorMentoring({ mentorCapacity: 2 }),
    participationCode: m1Code,
  });
  check("멘토 멘토링 신청 (정원 2명)", mentorApply.status === 200, String(mentorApply.json.error ?? ""));

  const badCapacity = await post("/api/mentoring", {
    role: "MENTOR",
    draft: mentorMentoring({ mentorCapacity: 5 }),
    participationCode: m1Code,
  });
  check(
    "고를 수 없는 정원은 읽히는 메시지로 거부",
    badCapacity.status === 400 && String(badCapacity.json.error ?? "").includes("후배 수"),
    String(badCapacity.json.error ?? ""),
  );

  const menteeApply = await post("/api/mentoring", {
    role: "MENTEE",
    draft: menteeMentoring(),
    participationCode: menteeCode,
  });
  check("멘티 멘토링 신청", menteeApply.status === 200, String(menteeApply.json.error ?? ""));

  // 남의 코드로 멘토링을 붙이는 것을 막아야 한다.
  const wrongRole = await post("/api/mentoring", {
    role: "MENTOR",
    draft: mentorMentoring(),
    participationCode: menteeCode,
  });
  check("역할이 다른 코드로 신청 거부", wrongRole.status === 400, String(wrongRole.json.error ?? ""));

  // 서버가 막지 않으면 DB 제약까지 내려가 "저장하지 못했어요"만 보게 된다.
  // 무엇이 잘못됐는지 알 수 없는 문구라, 읽히는 메시지가 돌아와야 한다.
  const badMbti = await post("/api/mentoring", {
    role: "MENTEE",
    draft: menteeMentoring({ mbti: "ZZZZ" }),
    participationCode: menteeCode,
  });
  check(
    "형식이 틀린 MBTI는 읽히는 메시지로 거부",
    badMbti.status === 400 && String(badMbti.json.error ?? "").includes("MBTI"),
    String(badMbti.json.error ?? ""),
  );

  const badArrival = await post("/api/mentoring", {
    role: "MENTEE",
    draft: menteeMentoring({ eventArrival: "2500" }),
    participationCode: menteeCode,
  });
  check(
    "고를 수 없는 채플 날 도착 시간은 읽히는 메시지로 거부",
    badArrival.status === 400 && String(badArrival.json.error ?? "").includes("채플"),
    String(badArrival.json.error ?? ""),
  );

  console.log("\n[2] 입력 검증 (서버가 다시 막는가)");
  const badPhone = await post("/api/signup", {
    role: "MENTEE",
    draft: mentee({ contact: "01012345678" }),
  });
  check("잘못된 연락처 형식 거부", badPhone.status === 400, String(badPhone.json.error ?? ""));

  const noConsent = await post("/api/signup", {
    role: "MENTEE",
    draft: { ...mentee({ contact: `${TEST_PREFIX}0009` }), consentedAt: undefined, consentVersion: undefined },
  });
  check("동의 없는 신청 거부", noConsent.status === 400, String(noConsent.json.error ?? ""));

  const noChurch = await post("/api/signup", {
    role: "MENTEE",
    draft: { ...mentee({ contact: `${TEST_PREFIX}0011` }), church: undefined, isNewFriend: false },
  });
  check("교회·새친구 둘 다 없으면 거부", noChurch.status === 400, String(noChurch.json.error ?? ""));

  const newFriend = await post("/api/signup", {
    role: "MENTEE",
    draft: mentee({ name: "새친구검증", contact: `${TEST_PREFIX}0012`, church: undefined, isNewFriend: true }),
  });
  check("교회 없이 새친구로는 등록 가능", newFriend.status === 200, String(newFriend.json.error ?? ""));

  const oldConsent = await post("/api/signup", {
    role: "MENTEE",
    draft: { ...mentee({ contact: `${TEST_PREFIX}0010` }), consentVersion: "1999-01-01" },
  });
  check("옛 동의 문구 거부", oldConsent.status === 400, String(oldConsent.json.error ?? ""));

  console.log("\n[3] 중복 신청");
  const dup = await post("/api/signup", { role: "MENTEE", draft: mentee() });
  check(
    "같은 사람 재신청 시 기존 코드 반환",
    dup.status === 200 && dup.json.alreadyRegistered === true && dup.json.participationCode === menteeCode,
    String(dup.json.participationCode ?? dup.json.error),
  );
  const otherName = await post("/api/signup", {
    role: "MENTEE",
    draft: mentee({ name: "다른사람" }),
  });
  check("같은 번호 다른 이름 거부", otherName.status === 400, String(otherName.json.error ?? ""));

  console.log("\n[4] 매칭");
  const match = await post("/api/match", { participationCode: menteeCode });
  const results = (match.json.results ?? []) as { mentor: Record<string, unknown>; score: number }[];
  check("매칭 계산", match.status === 200 && results.length > 0, `${results.length}명`);
  check(
    "응답에 전체 연락처 없음",
    !/010-\d{4}-\d{4}/.test(JSON.stringify(match.json).replace(/010-\*\*\*\*-\d{4}/g, "")),
  );
  check(
    "연락처가 마스킹됨",
    results.every((r) => String(r.mentor.maskedContact).includes("****")),
  );
  // 형식이 틀린 것과, 형식은 맞지만 없는 것을 구분해서 응답해야 한다.
  // XXXXXX 는 허용 문자로만 되어 있어 형식상 유효하다 -> 404 가 맞다.
  const malformed = await post("/api/match", { participationCode: "0OIL11" });
  check("형식이 틀린 참여코드 거부 (400)", malformed.status === 400, `HTTP ${malformed.status}`);
  const notFound = await post("/api/match", { participationCode: "XXXXXX" });
  check("없는 참여코드 (404)", notFound.status === 404, `HTTP ${notFound.status}`);

  console.log("\n[4-1] 대체 후보");
  // 지망 캠퍼스에 선배가 없으면 같은 학과 선배가 나와야 한다.
  // 검증 멘토는 연세대 경영학과. 제주대에 실제 멘토가 있으면 이 검사는 의미가 없다.
  const farMentee = await registerAndApply("검증멘티4", "0004", {
    targetCampus: ["제주대"],
    targetMajors: ["경영학과"],
  });
  const far = await post("/api/match", { participationCode: farMentee });
  const farResults = (far.json.results ?? []) as {
    mentor: { currentCampus: string };
    fallback?: string;
  }[];
  check(
    "지망 캠퍼스에 선배가 없으면 대체 후보를 표시해서 돌려줌",
    far.status === 200 &&
      farResults.length > 0 &&
      farResults.every((r) => r.fallback && r.mentor.currentCampus !== "제주대"),
    farResults.map((r) => `${r.mentor.currentCampus}:${r.fallback ?? "지망"}`).join(", ") ||
      "후보 0명",
  );
  const near = await post("/api/match", { participationCode: menteeCode });
  check(
    "지망 캠퍼스 후보에는 대체 표시가 없음",
    ((near.json.results ?? []) as { fallback?: string }[]).every((r) => !r.fallback),
  );

  // 실제 멘토가 섞여 있는 DB에서도 검증용 멘토만 건드린다.
  // 실제 선배의 자리를 검증이 잠시라도 차지하면 안 된다.
  const mentorId = results.find((r) => r.mentor.name === "검증멘토1")?.mentor.id as
    | string
    | undefined;
  check("검증용 멘토가 후보에 있음", !!mentorId);

  console.log("\n[5] 연락처 공개");
  const reveal = await post("/api/match/request", { participationCode: menteeCode, mentorId });
  check("매칭된 멘토에게 요청 시 공개", reveal.status === 200 && /^010-/.test(String(reveal.json.contact ?? "")));
  // 채플 날 도착 시간은 연결된 뒤에만 알려준다. 후보 카드에는 없어야 한다.
  check(
    "연결된 후배에게 선배의 채플 날 도착 시간 공개",
    reveal.json.mentorEventArrival === "1830",
    String(reveal.json.mentorEventArrival),
  );
  check(
    "후보 카드에는 도착 시간 없음",
    !JSON.stringify(match.json.results ?? []).includes("ventArrival"),
  );
  const fake = await post("/api/match/request", {
    participationCode: menteeCode,
    mentorId: "00000000-0000-0000-0000-000000000000",
  });
  check("매칭되지 않은 멘토 요청 거부", fake.status === 400);
  const stolen = await post("/api/match/request", { participationCode: "ZZZZZZ", mentorId });
  check("남의 참여코드로 요청 거부", stolen.status === 400);

  console.log("\n[5-1] 멘토 정원");
  // 검증 멘토의 정원은 2명. 방금 한 자리가 찼다.

  // ① 멘티는 여전히 선배를 한 명만 고른다. 이미 골랐는지부터 보므로
  //    다른 후보(실제 멘토일 수 있다)의 상태는 바뀌지 않는다.
  const secondMentorId = results.find((r) => r.mentor.id !== mentorId)?.mentor.id as
    | string
    | undefined;
  if (secondMentorId) {
    const twoMentors = await post("/api/match/request", {
      participationCode: menteeCode,
      mentorId: secondMentorId,
    });
    check("멘티가 두 번째 멘토 요청 시 거부", twoMentors.status === 400,
      String(twoMentors.json.error ?? ""));
  } else {
    check("멘티가 두 번째 멘토 요청 시 거부", true, "후보가 1명뿐이라 생략");
  }

  // ② 같은 연락처를 다시 요청하면 막지 않고 그대로 보여준다.
  const again = await post("/api/match/request", { participationCode: menteeCode, mentorId });
  check("같은 멘토 재요청 시 연락처 재공개", again.status === 200 && /^010-/.test(String(again.json.contact ?? "")));

  // ③ 자리가 남았으니 두 번째 후배는 같은 선배를 고를 수 있다.
  //    등록만 한 멘티로 시험하면 409로 후보가 0명이 되어 아무것도 확인하지 못한다.
  const secondCode = await registerAndApply("검증멘티2", "0002");
  const secondMatch = await post("/api/match", { participationCode: secondCode });
  const secondResults = (secondMatch.json.results ?? []) as { mentor: { id: string } }[];
  check(
    "정원이 남은 멘토는 다른 멘티 후보에 남음",
    secondResults.some((r) => r.mentor.id === mentorId),
    `후보 ${secondResults.length}명`,
  );
  const secondRequest = await post("/api/match/request", {
    participationCode: secondCode,
    mentorId,
  });
  check("두 번째 후배 연결 (2/2)", secondRequest.status === 200, String(secondRequest.json.error ?? ""));

  // ④ 정원이 찼으니 세 번째 후배의 후보에서는 빠진다.
  //    등록 한도를 아끼려고 [2]에서 등록한 새친구 멘티를 재사용한다.
  const thirdCode = await applyAsMentee(
    "새친구검증",
    newFriend.json.participationCode as string | undefined,
  );
  const thirdMatch = await post("/api/match", { participationCode: thirdCode });
  const thirdResults = (thirdMatch.json.results ?? []) as { mentor: { id: string } }[];
  check(
    "정원이 찬 멘토가 다른 멘티 후보에서 제외됨",
    thirdMatch.status === 200 && !thirdResults.some((r) => r.mentor.id === mentorId),
    `후보 ${thirdResults.length}명`,
  );

  // ⑤ 멘토는 연결된 후배 두 명을 모두 본다.
  const mentorView = await post("/api/mentor/match", { participationCode: m1Code });
  const linked = (mentorView.json.mentees ?? []) as { name: string; eventArrival?: string }[];
  check(
    "멘토 화면에 연결된 후배 2명과 정원 표시",
    mentorView.status === 200 && mentorView.json.capacity === 2 && linked.length === 2,
    linked.map((m) => m.name).join(", "),
  );
  check(
    "멘토 화면에 후배의 채플 날 도착 시간 표시",
    linked.every((m) => m.eventArrival === "1800"),
    linked.map((m) => m.eventArrival).join(", "),
  );

  // ⑥ 매칭을 마친 멘티가 다시 열면 자기 멘토가 그대로 보인다.
  //    줄어든 후보로 재계산하면 정작 본인 멘토가 사라진다.
  const revisit = await post("/api/match", { participationCode: menteeCode });
  const revisitResults = (revisit.json.results ?? []) as { mentor: { id: string } }[];
  check(
    "매칭 완료 후 재방문 시 자기 멘토 유지",
    revisit.json.settledMentorId === mentorId &&
      revisitResults.some((r) => r.mentor.id === mentorId),
    `settled=${String(revisit.json.settledMentorId)}`,
  );

  console.log("\n[5-2] 선배 알림 (운영자)");
  // 알림 기록은 운영자만 남길 수 있어야 한다. 아니면 누구나 "알렸음"으로 바꿔 빠뜨리게 만든다.
  const matchRow = (await (
    await fetch(
      `${dbUrl}/rest/v1/matchings?select=id&mentor_id=eq.${mentorId}&status=eq.REQUESTED&limit=1`,
      { headers: dbHeaders },
    )
  ).json()) as { id: string }[];
  const matchingId = matchRow[0]?.id;
  const anonymous = await post("/api/admin/mentor-notice", { matchingId });
  check("로그인 없이 알림 기록 거부", anonymous.status === 401, `HTTP ${anonymous.status}`);

  const password = loadEnv().ADMIN_PASSWORD;
  const login = await post("/api/admin/login", { password });
  const cookie = login.res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie || !matchingId) {
    check("운영자 로그인 후 알림 기록", false, !cookie ? "로그인 실패" : "매칭 행 없음");
  } else {
    const first = await post("/api/admin/mentor-notice", { matchingId }, cookie);
    const second = await post("/api/admin/mentor-notice", { matchingId }, cookie);
    check(
      "알림 기록 · 두 번 눌러도 처음 시각 유지",
      first.status === 200 && !!first.json.notifiedAt && second.json.notifiedAt === first.json.notifiedAt,
      String(first.json.notifiedAt ?? first.json.error),
    );
    const undo = await post("/api/admin/mentor-notice", { matchingId, undo: true }, cookie);
    check("알림 기록 되돌리기", undo.status === 200 && undo.json.notifiedAt === null);
    const bad = await post("/api/admin/mentor-notice", { matchingId: "not-a-uuid" }, cookie);
    check("잘못된 매칭 id 거부", bad.status === 400, `HTTP ${bad.status}`);
  }

  console.log("\n[6] 참여코드 조회");
  const found = await post("/api/lookup", { name: "검증멘티", contact: `${TEST_PREFIX}0001` });
  check("이름+번호 일치 시 조회", found.json.found === true && found.json.participationCode === menteeCode);
  const wrong = await post("/api/lookup", { name: "검증멘티", contact: "010-0000-0000" });
  check("번호 불일치 시 비공개", wrong.json.found === false);

  console.log("\n[7] 운영자 화면 접근 제어");
  const noAuth = await fetch(`${BASE}/admin`, { redirect: "manual" });
  check("로그인 없이 /admin 차단", noAuth.status === 307 || noAuth.status === 302, `HTTP ${noAuth.status}`);
  const forged = await fetch(`${BASE}/admin`, {
    headers: { Cookie: "ccc_admin=99999999999999.forged" },
    redirect: "manual",
  });
  check("위조 쿠키 차단", forged.status === 307 || forged.status === 302);
  const wrongPw = await post("/api/admin/login", { password: "wrong-password" });
  check("틀린 비밀번호 거부", wrongPw.status === 401);

  // 보기 전용 비밀번호는 선택이라, 설정한 곳에서만 확인한다.
  const viewerPassword = process.env.VIEWER_PASSWORD ?? loadEnv().VIEWER_PASSWORD;
  if (viewerPassword) {
    const viewerLogin = await post("/api/admin/login", { password: viewerPassword });
    const viewerCookie = viewerLogin.res.headers.get("set-cookie")?.split(";")[0] ?? "";
    check("보기 전용 로그인", viewerLogin.status === 200 && viewerLogin.json.role === "viewer");
    const viewerPage = await fetch(`${BASE}/admin`, { headers: { Cookie: viewerCookie }, redirect: "manual" });
    const viewerHtml = await viewerPage.text();
    check(
      "보기 전용 화면에 매칭 실행 버튼 없음",
      viewerPage.status === 200 && viewerHtml.includes("보기 전용") && !viewerHtml.includes("전체 매칭 실행"),
      `HTTP ${viewerPage.status}`,
    );
    const viewerWrite = await post("/api/admin/match-all", {}, viewerCookie);
    check("보기 전용은 운영자 API 거부", viewerWrite.status === 403, `HTTP ${viewerWrite.status}`);
  } else {
    console.log("  - 보기 전용 점검 건너뜀 (VIEWER_PASSWORD 없음)");
  }

  await cleanup();

  console.log("\n" + "=".repeat(56));
  console.log(failed === 0 ? `모든 흐름 검증 통과 (${passed}개 항목)` : `${failed}건 실패 / ${passed}건 통과`);
  console.log("=".repeat(56));
  console.log("검증용 데이터는 정리했습니다.");

  process.exit(failed === 0 ? 0 : 1);
}

void main();
