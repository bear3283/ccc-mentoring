/**
 * 검증용 멘토를 넣는다.
 *
 * 멘토가 없으면 멘티가 "0명을 찾았어요" 를 보게 되어 흐름 확인이 안 된다.
 * 연락처를 010-0088-XXXX 로 고정해 나중에 이것만 골라 지울 수 있게 한다.
 *
 * 실행:  npm run seed:demo
 * 정리:  npm run seed:demo -- --clean
 */
import { CONSENT_VERSION } from "../src/shared/constants/privacy";
import { supabaseAccess } from "./lib/env";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DEMO_PREFIX = "010-0088-";
const { url: dbUrl, headers: dbHeaders } = supabaseAccess();

const empty = {
  targetCampus: [], desiredAreas: [], targetMajors: [], targetCareers: [],
  mentoringArea: [], currentMajors: [], careerPaths: [],
};

const mentors = [
  { name: "조민준", gender: "MALE", contact: `${DEMO_PREFIX}0001`, personaType: "SOLOMON", mbti: "INTJ",
    currentCampus: "연세대", admissionYear: 2023, mentoringArea: ["학점관리", "전공공부"],
    currentMajors: ["경영학과"], careerPaths: ["금융권"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKEND_AFTERNOON"] },
  { name: "박선우", gender: "FEMALE", contact: `${DEMO_PREFIX}0002`, personaType: "ESTHER", mbti: "ENFP",
    currentCampus: "연세대", admissionYear: 2022, mentoringArea: ["학점관리", "자취생활"],
    currentMajors: ["심리학과"], careerPaths: ["대학원 진학"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKDAY_NIGHT"] },
  { name: "이서연", gender: "FEMALE", contact: `${DEMO_PREFIX}0003`, personaType: "NOAH", mbti: "ISFJ",
    currentCampus: "고려대", admissionYear: 2021, mentoringArea: ["학점관리", "자취생활", "진로설계"],
    currentMajors: ["경영학과"], careerPaths: ["금융권"], availableTimes: ["WEEKDAY_EVENING"] },
  { name: "강도윤", gender: "MALE", contact: `${DEMO_PREFIX}0004`, personaType: "DAVID",
    currentCampus: "서강대", admissionYear: 2024, mentoringArea: ["탐방", "동아리", "대외활동"],
    currentMajors: ["컴퓨터공학과"], careerPaths: ["개발자"],
    availableTimes: ["WEEKEND_MORNING", "WEEKEND_AFTERNOON"] },
  { name: "한지우", gender: "FEMALE", contact: `${DEMO_PREFIX}0005`, personaType: "SOLOMON", mbti: "INFP",
    currentCampus: "성균관대", admissionYear: 2022, mentoringArea: ["학점관리", "교환학생"],
    currentMajors: ["미디어커뮤니케이션학과"], careerPaths: ["언론/방송"],
    availableTimes: ["WEEKDAY_EVENING", "WEEKEND_EVENING"] },
];

async function clean() {
  await fetch(`${dbUrl}/rest/v1/users?contact=like.${DEMO_PREFIX}*`, {
    method: "DELETE", headers: dbHeaders,
  });
  console.log("검증용 멘토를 지웠습니다.");
}

async function main() {
  if (process.argv.includes("--clean")) return clean();

  await clean(); // 다시 넣기 전에 이전 것을 치운다
  console.log(`검증용 멘토 ${mentors.length}명 등록\n`);

  for (const m of mentors) {
    const res = await fetch(`${BASE}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "MENTOR",
        draft: { ...empty, ...m, consentedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION },
      }),
    });
    const body = (await res.json()) as { participationCode?: string; error?: string };
    const label = `${m.name}(${m.currentCampus})`.padEnd(14);
    console.log(`  ${label} ${body.participationCode ?? "실패: " + body.error}`);
  }

  console.log("\n지울 때:  npm run seed:demo -- --clean");
}

void main();
