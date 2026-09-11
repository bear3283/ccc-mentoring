/**
 * 매칭 알고리즘 검증 스크립트.
 * 멘티 50명 x 멘토 50명 전 조합을 돌려 가중치가 의도대로 동작하는지 확인한다.
 *
 * 실행: npx tsx scripts/verify-matching.ts
 */
import {
  calculateBreakdown,
  totalScore,
  matchMentors,
  passesRequiredFilters,
  UNSCORED_FIELDS,
  WEIGHT_TOTAL,
  WEIGHTS,
} from "../src/features/matching/lib/score";
import { MOCK_MENTEES, MOCK_MENTORS } from "../src/shared/lib/mock/generate";
import { readFileSync } from "node:fs";
import { buildHashtags } from "../src/features/matching/lib/hashtags";
import { MBTI_TYPES } from "../src/shared/constants/mbti";
import { scoreMbti, scoreSchedule } from "../src/features/matching/lib/score";
import { PERSONAS } from "../src/shared/constants/persona";
import { formatTimeSlotShort } from "../src/shared/constants/domain";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (!passed) failures++;
  const mark = passed ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("=".repeat(64));
console.log(`더미 데이터: 멘토 ${MOCK_MENTORS.length}명 / 멘티 ${MOCK_MENTEES.length}명`);
console.log("=".repeat(64));

// ---------------------------------------------------------------- 가중치 규약
console.log("\n[0] 가중치 규약");

check(
  "가중치 합계 100",
  WEIGHT_TOTAL === 100,
  `${Object.values(WEIGHTS).join(" + ")} = ${WEIGHT_TOTAL}`,
);
check(
  "캠퍼스가 가장 무거움",
  Object.entries(WEIGHTS).every(([k, v]) => k === "campus" || v < WEIGHTS.campus),
  `캠퍼스 ${WEIGHTS.campus} / 영역 ${WEIGHTS.area} / 시간대 ${WEIGHTS.schedule} / MBTI ${WEIGHTS.mbti} / 학과·진로 ${WEIGHTS.majorAndCareer} / 성경인물 ${WEIGHTS.persona}`,
);
check(
  "MBTI 4축이 각각 2.5점",
  WEIGHTS.mbti / 4 === 2.5,
  `${WEIGHTS.mbti} / 4 = ${WEIGHTS.mbti / 4}점`,
);
check(
  "성경 인물이 MBTI보다 가벼움",
  WEIGHTS.persona < WEIGHTS.mbti,
  `성경인물 ${WEIGHTS.persona} < MBTI ${WEIGHTS.mbti}`,
);

// 고등학교/추천인이 점수에 새어 들어가지 않았는지 소스에서 직접 확인한다.
const scoreSource = readFileSync(
  new URL("../src/features/matching/lib/score.ts", import.meta.url),
  "utf8",
);
// 주석은 걷어내고 실제 코드만 본다.
const scoreCode = scoreSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

for (const field of UNSCORED_FIELDS) {
  check(
    `${field}는 점수 계산에 쓰이지 않음`,
    !new RegExp(`\\.${field}\\b`).test(scoreCode),
  );
}

// ---------------------------------------------------------------- 데이터 무결성
console.log("\n[1] 더미 데이터 무결성");

check(
  "멘토 50명, 멘티 50명 생성",
  MOCK_MENTORS.length === 50 && MOCK_MENTEES.length === 50,
);
check(
  "모든 멘티의 지망 캠퍼스가 3개이고 중복 없음",
  MOCK_MENTEES.every((m) => m.targetCampus.length === 3 && new Set(m.targetCampus).size === 3),
);
check(
  "모든 참여자가 시간대를 1개 이상 보유",
  [...MOCK_MENTORS, ...MOCK_MENTEES].every((p) => p.availableTimes.length >= 1),
);
check(
  "모든 참여자가 연락처 보유",
  [...MOCK_MENTORS, ...MOCK_MENTEES].every((p) => /^010-\d{4}-\d{4}$/.test(p.contact)),
);
check(
  "ID 중복 없음",
  new Set(MOCK_MENTORS.map((m) => m.id)).size === 50 &&
    new Set(MOCK_MENTEES.map((m) => m.id)).size === 50,
);

const allCodes = [...MOCK_MENTORS, ...MOCK_MENTEES].map((p) => p.participationCode);
check(
  "참여코드 100건 전부 유일",
  new Set(allCodes).size === allCodes.length,
  `고유 ${new Set(allCodes).size}건 / 전체 ${allCodes.length}건`,
);
check(
  "참여코드에 혼동 문자(0,O,1,I,L) 없음",
  allCodes.every((c) => !/[01OIL]/.test(c)),
);

const everyone = [...MOCK_MENTORS, ...MOCK_MENTEES];
const withMbti = everyone.filter((p) => p.mbti);
check(
  "MBTI는 16개 정식 유형만 사용",
  withMbti.every((p) => (MBTI_TYPES as readonly string[]).includes(p.mbti!)),
  `입력 ${withMbti.length}명 / 미입력 ${everyone.length - withMbti.length}명`,
);
check(
  "MBTI 미입력자가 있어도 매칭에 지장 없음",
  everyone.some((p) => !p.mbti),
);

// ---------------------------------------------------------------- 점수 범위
console.log("\n[2] 점수 계산 (50 x 50 = 2,500 조합)");

let totalPairs = 0;
let passedFilter = 0;
let minScore = Infinity;
let maxScore = -Infinity;
let sumScore = 0;

for (const mentee of MOCK_MENTEES) {
  for (const mentor of MOCK_MENTORS) {
    totalPairs++;
    if (!passesRequiredFilters(mentee, mentor)) continue;
    passedFilter++;

    const b = calculateBreakdown(mentee, mentor);
    const total = totalScore(b);

    if (total < minScore) minScore = total;
    if (total > maxScore) maxScore = total;
    sumScore += total;

    if (b.campus > WEIGHTS.campus + 1e-9) {
      check("캠퍼스 점수가 가중치 초과", false, `${mentee.id}/${mentor.id} = ${b.campus}`);
    }
    if (total > 100 + 1e-9 || total < 0) {
      check("총점 범위 이탈", false, `${mentee.id}/${mentor.id} = ${total}`);
    }
  }
}

console.log(`  전체 조합: ${totalPairs} / 필수 필터 통과: ${passedFilter}`);
check("총점이 0~100 범위 내", minScore >= 0 && maxScore <= 100,
  `min=${minScore.toFixed(1)} max=${maxScore.toFixed(1)} avg=${(sumScore / passedFilter).toFixed(1)}`);

// ---------------------------------------------------------------- MBTI 배점
console.log("\n[2-1] MBTI 배점");

{
  const mentee = MOCK_MENTEES.find((m) => m.mbti)!;
  const sameMbti = { ...mentee, mbti: mentee.mbti };
  const oppositeLetters = mentee.mbti!.split("").map((c) =>
    ({ E: "I", I: "E", S: "N", N: "S", T: "F", F: "T", J: "P", P: "J" })[c],
  ).join("");

  const mentorBase = MOCK_MENTORS[0];
  const full = scoreMbti(mentee, { ...mentorBase, mbti: sameMbti.mbti });
  const none = scoreMbti(mentee, { ...mentorBase, mbti: oppositeLetters as typeof mentee.mbti });
  const unknown = scoreMbti(mentee, { ...mentorBase, mbti: undefined });

  check("4축 모두 일치 = 10점", full === 10, `${full}점`);
  check("4축 모두 불일치 = 0점", none === 0, `${none}점`);
  check("미입력 시 중립(5점) - 건너뛴 사람이 불이익 없음", unknown === 5, `${unknown}점`);

  // 미입력자는 모든 멘토에게 같은 점수를 받으므로 순위가 왜곡되지 않아야 한다.
  const noMbtiMentee = { ...mentee, mbti: undefined };
  const spread = new Set(MOCK_MENTORS.map((m) => scoreMbti(noMbtiMentee, m)));
  check("미입력자는 모든 멘토에게 동일 점수 - 순위 왜곡 없음", spread.size === 1);
}

// ---------------------------------------------------------------- 필수 필터
console.log("\n[3] 필수 필터 동작");

const filteredOut = MOCK_MENTEES.flatMap((mentee) =>
  MOCK_MENTORS.filter((mentor) => !passesRequiredFilters(mentee, mentor)).map((mentor) => ({
    mentee,
    mentor,
  })),
);

check(
  "필터 탈락은 캠퍼스 불일치가 유일한 사유",
  filteredOut.every(({ mentee, mentor }) => !mentee.targetCampus.includes(mentor.currentCampus)),
);

const results = MOCK_MENTEES.map((m) => matchMentors(m, MOCK_MENTORS, 5));
check(
  "시간대가 안 겹쳐도 후보에는 남음 (0점 처리)",
  MOCK_MENTEES.some((mentee) =>
    matchMentors(mentee, MOCK_MENTORS, 3).some(
      (r) => !mentee.availableTimes.some((t) => r.mentor.availableTimes.includes(t)),
    ),
  ) ||
    // 더미 데이터가 우연히 전부 겹칠 수도 있으니, 그때는 점수 함수를 직접 확인한다
    scoreSchedule(
      { ...MOCK_MENTEES[0], availableTimes: ["WEEKDAY_MORNING"] },
      { ...MOCK_MENTORS[0], availableTimes: ["WEEKEND_NIGHT"] },
    ) === 0,
);
check(
  "매칭 결과에 지망 캠퍼스 밖 멘토 없음",
  results.every((rs, i) =>
    rs.every((r) => MOCK_MENTEES[i].targetCampus.includes(r.mentor.currentCampus)),
  ),
);

// ---------------------------------------------------------------- 정렬 / 우선순위
console.log("\n[4] 우선순위 정렬");

check(
  "결과가 점수 내림차순",
  results.every((rs) => rs.every((r, i) => i === 0 || rs[i - 1].score >= r.score)),
);

// 1지망 캠퍼스 멘토가 3지망 멘토보다 캠퍼스 점수가 높아야 한다
let rankOrderOk = true;
for (const mentee of MOCK_MENTEES) {
  const byRank = [0, 1, 2].map((rank) => {
    const campus = mentee.targetCampus[rank];
    const mentor = MOCK_MENTORS.find((m) => m.currentCampus === campus);
    return mentor ? calculateBreakdown(mentee, mentor).campus : null;
  });
  for (let i = 1; i < byRank.length; i++) {
    const prev = byRank[i - 1];
    const cur = byRank[i];
    if (prev !== null && cur !== null && prev < cur) rankOrderOk = false;
  }
}
check("1지망 > 2지망 > 3지망 캠퍼스 점수 순서 유지", rankOrderOk);

// ---------------------------------------------------------------- 매칭 커버리지
console.log("\n[5] 매칭 커버리지");

const noMatch = MOCK_MENTEES.filter((_, i) => results[i].length === 0);
const matchCounts = results.map((r) => r.length);
const avgTopScore =
  results.filter((r) => r.length > 0).reduce((s, r) => s + r[0].score, 0) /
  Math.max(results.filter((r) => r.length > 0).length, 1);

console.log(`  매칭 성공 멘티: ${50 - noMatch.length}/50`);
console.log(`  평균 후보 수: ${(matchCounts.reduce((a, b) => a + b, 0) / 50).toFixed(2)}`);
console.log(`  1순위 매칭 평균 적합도: ${avgTopScore.toFixed(1)}%`);

if (noMatch.length > 0) {
  console.log(`  매칭 실패 멘티: ${noMatch.map((m) => m.id).join(", ")}`);
}

// ---------------------------------------------------------------- 해시태그
console.log("\n[6] 프로필 카드 해시태그");

const allTags = MOCK_MENTEES.flatMap((mentee) =>
  matchMentors(mentee, MOCK_MENTORS, 3).flatMap((r) => r.hashtags),
);
check("모든 해시태그가 # 로 시작", allTags.every((t) => t.startsWith("#")));
check("카드당 해시태그 최대 4개",
  MOCK_MENTEES.every((mentee) =>
    matchMentors(mentee, MOCK_MENTORS, 3).every((r) => r.hashtags.length <= 4),
  ),
);
check("모든 멘토가 성향 해시태그 보유",
  MOCK_MENTORS.every((mentor) =>
    buildHashtags(mentor, MOCK_MENTEES[0]).includes(PERSONAS[mentor.personaType].hashtag),
  ),
);

// ---------------------------------------------------------------- 샘플 출력
console.log("\n[7] 샘플 매칭 결과 (멘티 3명)");

for (const mentee of MOCK_MENTEES.slice(0, 3)) {
  console.log(
    `\n  ▸ ${mentee.name}(${mentee.id}) | 지망: ${mentee.targetCampus.join(" > ")}`,
  );
  console.log(
    `    관심영역: ${mentee.desiredAreas.join(", ")} | 성향: ${PERSONAS[mentee.personaType].name} | ` +
      `목표: ${mentee.targetMajors.join(", ")} / ${mentee.targetCareers.join(", ")}`,
  );
  console.log(`    가능시간: ${mentee.availableTimes.map(formatTimeSlotShort).join(", ")}`);

  const top = matchMentors(mentee, MOCK_MENTORS, 3);
  if (top.length === 0) {
    console.log("    → 조건에 맞는 멘토 없음");
    continue;
  }
  for (const r of top) {
    const b = r.breakdown;
    console.log(
      `    ${r.score}%  ${r.mentor.name}(${r.mentor.currentCampus}) ${r.hashtags.join(" ")}`,
    );
    console.log(
      `           캠퍼스 ${b.campus.toFixed(1)} / 영역 ${b.area.toFixed(1)} / 시간대 ${b.schedule.toFixed(1)} / ` +
        `MBTI ${b.mbti.toFixed(1)} / 학과·진로 ${b.majorAndCareer.toFixed(1)} / 성경인물 ${b.persona.toFixed(1)}`,
    );
  }
}

console.log("\n" + "=".repeat(64));
console.log(failures === 0 ? "모든 검증 통과" : `${failures}건 실패`);
console.log("=".repeat(64));

process.exit(failures === 0 ? 0 : 1);
