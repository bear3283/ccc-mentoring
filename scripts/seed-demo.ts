/**
 * 검증용 멘토를 넣는다.
 *
 * 멘토가 없으면 멘티가 "0명을 찾았어요" 를 보게 되어 흐름 확인이 안 된다.
 * 연락처를 010-0088-XXXX 로 고정해 나중에 이것만 골라 지울 수 있게 한다.
 *
 * API(/api/signup)가 아니라 DB에 직접 넣는다. 저장 속도 제한이 10분에 5건이라
 * API로는 10명을 한 번에 넣을 수 없다. 대신 saveSignup 과 같은 순서로 쓴다
 * — users 를 넣고 mentor_profiles 를 넣되, 프로필이 실패하면 users 를 되돌린다.
 *
 * 실행:  npm run seed:demo
 * 정리:  npm run seed:demo -- --clean
 */
import { generateParticipationCode } from "../src/features/onboarding/lib/participationCode";
import { CONSENT_VERSION } from "../src/shared/constants/privacy";
import { supabaseAccess } from "./lib/env";

const DEMO_PREFIX = "010-0088-";
const { url, headers } = supabaseAccess();

interface DemoMentor {
  name: string;
  gender: "MALE" | "FEMALE";
  personaType: "DAVID" | "SOLOMON" | "ESTHER" | "NOAH";
  /** 비워두면 매칭에서 축마다 절반을 받는다. 그 경로도 확인해야 해서 일부러 섞는다. */
  mbti?: string;
  church?: string;
  currentCampus: string;
  admissionYear: number;
  mentoringArea: string[];
  currentMajors: string[];
  careerPaths: string[];
  availableTimes: string[];
}

/**
 * 캠퍼스를 서울권 10곳으로 흩어 두었다.
 * 한 학교에 몰리면 다른 학교를 지망한 멘티가 또 "0명"을 보게 된다.
 */
const mentors: DemoMentor[] = [
  { name: "조민준", gender: "MALE", personaType: "SOLOMON", mbti: "INTJ", church: "신길교회",
    currentCampus: "연세대", admissionYear: 2023, mentoringArea: ["학점관리", "전공공부"],
    currentMajors: ["경영학과"], careerPaths: ["금융권"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKEND_AFTERNOON"] },
  { name: "박선우", gender: "FEMALE", personaType: "ESTHER", mbti: "ENFP",
    currentCampus: "연세대", admissionYear: 2022, mentoringArea: ["학점관리", "자취생활"],
    currentMajors: ["심리학과"], careerPaths: ["대학원 진학"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKDAY_NIGHT"] },
  { name: "서준호", gender: "MALE", personaType: "DAVID", mbti: "ESTP", church: "신길교회",
    currentCampus: "서울대", admissionYear: 2023, mentoringArea: ["전공공부", "진로설계"],
    currentMajors: ["컴퓨터공학과"], careerPaths: ["개발자"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKEND_AFTERNOON"] },
  { name: "임하늘", gender: "FEMALE", personaType: "ESTHER", mbti: "ENFJ",
    currentCampus: "서울대", admissionYear: 2022, mentoringArea: ["동아리", "대외활동", "진로설계"],
    currentMajors: ["사회학과"], careerPaths: ["대기업 취업"],
    availableTimes: ["WEEKEND_MORNING", "WEEKEND_LUNCH"] },
  { name: "이서연", gender: "FEMALE", personaType: "NOAH", mbti: "ISFJ",
    currentCampus: "고려대", admissionYear: 2021, mentoringArea: ["학점관리", "자취생활", "진로설계"],
    currentMajors: ["경영학과"], careerPaths: ["금융권"],
    availableTimes: ["WEEKDAY_EVENING"] },
  // MBTI 를 적지 않은 멘토. 매칭에서 축마다 절반을 받는 경로를 확인한다.
  { name: "강도윤", gender: "MALE", personaType: "DAVID",
    currentCampus: "서강대", admissionYear: 2024, mentoringArea: ["탐방", "동아리", "대외활동"],
    currentMajors: ["컴퓨터공학과"], careerPaths: ["개발자"],
    availableTimes: ["WEEKEND_MORNING", "WEEKEND_AFTERNOON"] },
  { name: "한지우", gender: "FEMALE", personaType: "SOLOMON", mbti: "INFP",
    currentCampus: "성균관대", admissionYear: 2022, mentoringArea: ["학점관리", "교환학생"],
    currentMajors: ["언론정보학과"], careerPaths: ["언론/방송"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKEND_EVENING"] },
  { name: "정태윤", gender: "MALE", personaType: "SOLOMON", mbti: "INTP",
    currentCampus: "한양대", admissionYear: 2023, mentoringArea: ["전공공부", "교환학생"],
    currentMajors: ["기계공학과"], careerPaths: ["연구원"],
    availableTimes: ["WEEKDAY_NIGHT", "WEEKEND_EVENING"] },
  { name: "윤채원", gender: "FEMALE", personaType: "NOAH", mbti: "ISTJ", church: "신길교회",
    currentCampus: "이화여대", admissionYear: 2021, mentoringArea: ["학점관리", "전공공부"],
    currentMajors: ["영어영문학과"], careerPaths: ["교사"],
    availableTimes: ["WEEKDAY_AFTERNOON", "WEEKDAY_EVENING"] },
  { name: "오지훈", gender: "MALE", personaType: "DAVID",
    currentCampus: "중앙대", admissionYear: 2024, mentoringArea: ["탐방", "자취생활", "동아리"],
    currentMajors: ["경영학과"], careerPaths: ["창업"],
    availableTimes: ["WEEKEND_AFTERNOON", "WEEKEND_EVENING"] },
];

async function clean() {
  const res = await fetch(`${url}/rest/v1/users?contact=like.${DEMO_PREFIX}*`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    console.error(`지우지 못했습니다 — ${await res.text()}`);
    process.exit(1);
  }
}

/** users 한 행. 실패하면 사유를 그대로 올린다 — 조용히 넘기면 원인을 알 수 없다. */
async function addUser(m: DemoMentor, contact: string): Promise<string> {
  const res = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      role: "MENTOR",
      participation_code: generateParticipationCode(),
      name: m.name,
      gender: m.gender,
      contact,
      persona_type: m.personaType,
      mbti: m.mbti ?? null,
      church: m.church ?? null,
      is_new_friend: false,
      // 이게 false 면 매칭 후보에서 빠진다. 검증용 멘토는 2단계까지 마친 상태여야 한다.
      mentoring_applied: true,
      available_times: m.availableTimes,
      consented_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const [row] = (await res.json()) as { id: string; participation_code: string }[];
  return row.id;
}

async function addProfile(m: DemoMentor, userId: string) {
  const res = await fetch(`${url}/rest/v1/mentor_profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      current_campus: m.currentCampus,
      admission_year: m.admissionYear,
      mentoring_area: m.mentoringArea,
      current_majors: m.currentMajors,
      career_paths: m.careerPaths,
    }),
  });
  if (!res.ok) {
    // 프로필이 없는 users 행이 남으면 매칭에서 터진다. 되돌린다.
    await fetch(`${url}/rest/v1/users?id=eq.${userId}`, { method: "DELETE", headers });
    throw new Error(await res.text());
  }
}

async function main() {
  if (process.argv.includes("--clean")) {
    await clean();
    console.log("검증용 멘토를 지웠습니다.");
    return;
  }

  await clean(); // 다시 넣기 전에 이전 것을 치운다
  console.log(`검증용 멘토 ${mentors.length}명 등록\n`);

  let failed = 0;
  for (const [i, m] of mentors.entries()) {
    const contact = `${DEMO_PREFIX}${String(i + 1).padStart(4, "0")}`;
    const label = `${m.name}(${m.currentCampus})`.padEnd(16);
    try {
      await addProfile(m, await addUser(m, contact));
      console.log(`  ✓ ${label} ${contact}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${label} ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(
    failed === 0
      ? "\n지울 때:  npm run seed:demo -- --clean"
      : `\n${failed}명이 실패했습니다. 위 사유를 확인하세요.`,
  );
  if (failed > 0) process.exit(1);
}

void main();
