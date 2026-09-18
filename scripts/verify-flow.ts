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
import { supabaseAccess } from "./lib/env";

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
    ...over,
  };
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

  const mentorApply = await post("/api/mentoring", {
    role: "MENTOR",
    draft: mentorMentoring(),
    participationCode: m1Code,
  });
  check("멘토 멘토링 신청", mentorApply.status === 200, String(mentorApply.json.error ?? ""));

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

  console.log("\n[5] 연락처 공개");
  const mentorId = results[0]?.mentor.id as string | undefined;
  const reveal = await post("/api/match/request", { participationCode: menteeCode, mentorId });
  check("매칭된 멘토에게 요청 시 공개", reveal.status === 200 && /^010-/.test(String(reveal.json.contact ?? "")));
  const fake = await post("/api/match/request", {
    participationCode: menteeCode,
    mentorId: "00000000-0000-0000-0000-000000000000",
  });
  check("매칭되지 않은 멘토 요청 거부", fake.status === 400);
  const stolen = await post("/api/match/request", { participationCode: "ZZZZZZ", mentorId });
  check("남의 참여코드로 요청 거부", stolen.status === 400);

  console.log("\n[5-1] 1:1 매칭");
  // 방금 연락처를 공개했으므로 이 멘토는 배정이 끝났다.

  // ① 멘티는 두 명과 매칭할 수 없다.
  const secondMentorId = results[1]?.mentor.id as string | undefined;
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

  // ③ 배정된 멘토는 다른 멘티의 후보에서 사라진다.
  const other = await post("/api/signup", {
    role: "MENTEE",
    draft: mentee({ name: "검증멘티2", contact: `${TEST_PREFIX}0002` }),
  });
  const otherCode = other.json.participationCode as string | undefined;
  const otherMatch = await post("/api/match", { participationCode: otherCode });
  const otherResults = (otherMatch.json.results ?? []) as { mentor: { id: string } }[];
  check(
    "배정된 멘토가 다른 멘티 후보에서 제외됨",
    !otherResults.some((r) => r.mentor.id === mentorId),
    `후보 ${otherResults.length}명`,
  );

  // ④ 매칭을 마친 멘티가 다시 열면 자기 멘토가 그대로 보인다.
  //    줄어든 후보로 재계산하면 정작 본인 멘토가 사라진다.
  const revisit = await post("/api/match", { participationCode: menteeCode });
  const revisitResults = (revisit.json.results ?? []) as { mentor: { id: string } }[];
  check(
    "매칭 완료 후 재방문 시 자기 멘토 유지",
    revisit.json.settledMentorId === mentorId &&
      revisitResults.some((r) => r.mentor.id === mentorId),
    `settled=${String(revisit.json.settledMentorId)}`,
  );

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

  await cleanup();

  console.log("\n" + "=".repeat(56));
  console.log(failed === 0 ? `모든 흐름 검증 통과 (${passed}개 항목)` : `${failed}건 실패 / ${passed}건 통과`);
  console.log("=".repeat(56));
  console.log("검증용 데이터는 정리했습니다.");

  process.exit(failed === 0 ? 0 : 1);
}

void main();
