/**
 * 서울 지역 모든 캠퍼스에 시험용 선배를 한 명씩 넣는다. 캠퍼스 인증까지 마친 상태다.
 *
 * 마지막 리허설에서 어느 서울 학교를 지망해도 선배가 추천되는지 보려고 쓴다.
 * 연락처를 010-0087-XXXX 로 고정해 이것만 골라 지울 수 있게 한다
 * (seed-demo 의 데모 선배는 010-0088-, verify-flow 는 010-0099- 를 쓴다).
 *
 * 성별은 번갈아 넣되, 여대는 여자 선배로 넣는다. 학과는 그 학교에 실제로 있는
 * 학과 중에서 고른다(대학알리미 공시). 값은 매번 같게 나오도록 학교 이름으로 정한다.
 *
 * API 대신 DB 에 직접 넣는다. 등록 저장은 속도 제한이 있어 52명을 한 번에 넣을 수 없다.
 *
 * 실행:  npm run seed:seoul
 * 정리:  npm run seed:seoul -- --clean
 */
import { CAMPUSES_BY_REGION } from "../src/shared/constants/campus";
import { majorsByField } from "../src/shared/constants/campusMajors";
import { MAJOR_FIELDS, MENTORING_AREAS } from "../src/shared/constants/domain";
import { MBTI_TYPES } from "../src/shared/constants/mbti";
import { PERSONA_TYPES } from "../src/shared/constants/persona";
import { CONSENT_VERSION } from "../src/shared/constants/privacy";
import { generateParticipationCode } from "../src/features/onboarding/lib/participationCode";
import { supabaseAccess } from "./lib/env";

const PREFIX = "010-0087-";
const { url, headers } = supabaseAccess();

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const MALE = ["민준", "서준", "도윤", "예준", "시우", "주원", "하준", "지호", "준서", "건우", "현우", "우진"];
const FEMALE = ["서연", "서윤", "지우", "하은", "민서", "지유", "윤서", "채원", "수아", "지민", "예은", "다은"];
const ARRIVALS = ["1700", "1730", "1800", "1830", "1900_LATER"] as const;

/** 학교 이름에서 늘 같은 수를 뽑는다. 다시 넣어도 같은 선배가 나온다. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}
function pick<T>(list: readonly T[], seed: number): T {
  return list[seed % list.length];
}

async function clean() {
  const res = await fetch(`${url}/rest/v1/users?contact=like.${PREFIX}*`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`지우지 못했습니다 — ${await res.text()}`);
}

async function main() {
  await clean();
  if (process.argv.includes("--clean")) {
    console.log("서울 시험용 선배를 지웠습니다.");
    return;
  }

  const campuses = CAMPUSES_BY_REGION["서울"];
  console.log(`서울 캠퍼스 ${campuses.length}곳에 시험용 선배를 한 명씩 넣습니다 (인증됨)\n`);

  let failed = 0;
  // 성별은 남녀 공학끼리만 번갈아 센다. 전체 순번으로 번갈면 여대 몫까지 겹쳐 여자 선배로 쏠린다.
  let coed = 0;
  for (const [i, campus] of campuses.entries()) {
    const h = hash(campus);
    const womens = campus.includes("여대") || campus.includes("여자");
    const female = womens || coed++ % 2 === 1;
    const name = pick(SURNAMES, h) + pick(female ? FEMALE : MALE, h >>> 4);
    const byField = majorsByField([campus]);
    const majors = MAJOR_FIELDS.flatMap((f) => byField[f]);
    const major = pick(majors, h >>> 8);
    const areas = [...new Set([pick(MENTORING_AREAS, h), pick(MENTORING_AREAS, h >>> 3), pick(MENTORING_AREAS, h >>> 6)])];
    const contact = `${PREFIX}${String(i + 1).padStart(4, "0")}`;

    try {
      const userRes = await fetch(`${url}/rest/v1/users`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          role: "MENTOR",
          participation_code: generateParticipationCode(),
          name,
          gender: female ? "FEMALE" : "MALE",
          contact,
          persona_type: pick(PERSONA_TYPES, h >>> 5),
          mbti: pick(MBTI_TYPES, h >>> 7),
          is_new_friend: false,
          mentoring_applied: true,
          event_arrival: pick(ARRIVALS, h >>> 9),
          consented_at: new Date().toISOString(),
          consent_version: CONSENT_VERSION,
        }),
      });
      if (!userRes.ok) throw new Error(await userRes.text());
      const [user] = (await userRes.json()) as { id: string }[];

      const profileRes = await fetch(`${url}/rest/v1/mentor_profiles`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: user.id,
          current_campus: campus,
          admission_year: 2020 + (h % 6),
          mentoring_area: areas,
          current_majors: [major],
          career_paths: [],
          capacity: 2,
          verified_at: new Date().toISOString(),
        }),
      });
      if (!profileRes.ok) {
        // 프로필 없는 users 행이 남으면 매칭에서 터진다. 되돌린다.
        await fetch(`${url}/rest/v1/users?id=eq.${user.id}`, { method: "DELETE", headers });
        throw new Error(await profileRes.text());
      }
      console.log(`  ✓ ${campus.padEnd(10)} ${name} ${female ? "여" : "남"} · ${major} · ${contact}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${campus} ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(
    failed === 0
      ? `\n${campuses.length}명을 넣었습니다. 지울 때:  npm run seed:seoul -- --clean`
      : `\n${failed}명이 실패했습니다. 위 사유를 확인하세요.`,
  );
  if (failed > 0) process.exit(1);
}

void main();
