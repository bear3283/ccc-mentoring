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
import {
  fallbackReason,
  recommendMentors,
  scoreMbti,
  scorePersona,
} from "../src/features/matching/lib/score";
import { campusDemand } from "../src/features/admin/lib/campusDemand";
import { CAMPUSES_BY_REGION, regionOf } from "../src/shared/constants/campus";
import { PERSONAS } from "../src/shared/constants/persona";

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
  `캠퍼스 ${WEIGHTS.campus} / 영역 ${WEIGHTS.area} / MBTI ${WEIGHTS.mbti} / 학과·진로 ${WEIGHTS.majorAndCareer} / 성경인물 ${WEIGHTS.persona}`,
);
check(
  "MBTI 4축이 같은 점수로 나뉨",
  (WEIGHTS.mbti / 4) * 4 === WEIGHTS.mbti,
  `${WEIGHTS.mbti} / 4 = ${WEIGHTS.mbti / 4}점`,
);
check(
  "성경 인물이 MBTI보다 무겁지 않음 (둘 다 보조 지표)",
  WEIGHTS.persona <= WEIGHTS.mbti,
  `성경인물 ${WEIGHTS.persona} ≤ MBTI ${WEIGHTS.mbti}`,
);
check(
  "실질 신호(학교·분야·학과진로)가 성향(MBTI·성경인물)보다 무거움",
  WEIGHTS.majorAndCareer > WEIGHTS.mbti + WEIGHTS.persona,
  `학과·진로 ${WEIGHTS.majorAndCareer} > 성향 ${WEIGHTS.mbti + WEIGHTS.persona}`,
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
  "모든 참여자가 성별 보유",
  [...MOCK_MENTORS, ...MOCK_MENTEES].every((p) => p.gender === "MALE" || p.gender === "FEMALE"),
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

  check(`4축 모두 일치 = ${WEIGHTS.mbti}점`, full === WEIGHTS.mbti, `${full}점`);
  check("4축 모두 불일치 = 0점", none === 0, `${none}점`);
  check(
    `미입력 시 중립(${WEIGHTS.mbti / 2}점) - 건너뛴 사람이 불이익 없음`,
    unknown === WEIGHTS.mbti / 2,
    `${unknown}점`,
  );

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
  "필터 탈락 사유는 캠퍼스 불일치 또는 성별 다름뿐",
  filteredOut.every(
    ({ mentee, mentor }) =>
      !mentee.targetCampus.includes(mentor.currentCampus) || mentee.gender !== mentor.gender,
  ),
);

const results = MOCK_MENTEES.map((m) => matchMentors(m, MOCK_MENTORS, 5));
check(
  "매칭 결과는 모두 같은 성별",
  results.every((rs, i) => rs.every((r) => r.mentor.gender === MOCK_MENTEES[i].gender)),
);
check(
  "대체 후보도 모두 같은 성별",
  MOCK_MENTEES.every((mentee) =>
    recommendMentors(mentee, MOCK_MENTORS, 5).every((r) => r.mentor.gender === mentee.gender),
  ),
);
check(
  "성별이 비어 있는 멘티는 후보가 없음",
  recommendMentors({ ...MOCK_MENTEES[0], gender: undefined }, MOCK_MENTORS, 5).length === 0,
);
check(
  "성별이 비어 있는 멘토는 누구의 후보도 아님",
  MOCK_MENTEES.every(
    (mentee) => !passesRequiredFilters(mentee, { ...MOCK_MENTORS[0], gender: undefined }),
  ),
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

// ---------------------------------------------------------------- 대체 후보
console.log("\n[5-1] 대체 후보 (지망 캠퍼스에 선배가 없을 때)");

const recommended = MOCK_MENTEES.map((m) => recommendMentors(m, MOCK_MENTORS, 5));

check(
  "지망 캠퍼스 후보가 있으면 대체 후보를 섞지 않음",
  MOCK_MENTEES.every(
    (_, i) =>
      results[i].length === 0 ||
      (recommended[i].every((r) => !r.fallback) &&
        recommended[i].map((r) => r.mentor.id).join() ===
          results[i].map((r) => r.mentor.id).join()),
  ),
);

const fallbackPairs = MOCK_MENTEES.flatMap((mentee, i) =>
  results[i].length === 0 ? recommended[i].map((r) => ({ mentee, r })) : [],
);

check(
  "대체 후보는 모두 지망 캠퍼스 밖",
  fallbackPairs.every(({ mentee, r }) => !mentee.targetCampus.includes(r.mentor.currentCampus)),
);
check(
  "MAJOR 후보는 희망 학과를 다니는 선배",
  fallbackPairs
    .filter(({ r }) => r.fallback === "MAJOR")
    .every(({ mentee, r }) => r.mentor.currentMajors.some((m) => mentee.targetMajors.includes(m))),
);
check(
  "REGION 후보는 지망 캠퍼스와 같은 지역이고 학과는 겹치지 않음",
  fallbackPairs
    .filter(({ r }) => r.fallback === "REGION")
    .every(
      ({ mentee, r }) =>
        mentee.targetCampus.some((c) => regionOf(c) === regionOf(r.mentor.currentCampus)) &&
        !r.mentor.currentMajors.some((m) => mentee.targetMajors.includes(m)),
    ),
);
check(
  "학과 후보가 지역 후보보다 앞, 같은 이유 안에서는 점수 내림차순",
  MOCK_MENTEES.every((_, i) => {
    if (results[i].length > 0) return true;
    const list = recommended[i];
    return list.every((r, k) => {
      if (k === 0) return true;
      const prev = list[k - 1];
      if (prev.fallback === r.fallback) return prev.score >= r.score;
      return prev.fallback === "MAJOR" && r.fallback === "REGION";
    });
  }),
);
check(
  "지망 캠퍼스 선배에게는 대체 사유가 붙지 않음",
  MOCK_MENTEES.every((mentee) =>
    MOCK_MENTORS.filter((m) => mentee.targetCampus.includes(m.currentCampus)).every(
      (m) => fallbackReason(mentee, m) === undefined,
    ),
  ),
);

// 더미 학과는 12개뿐이라 거의 모두 학과 단계에서 걸린다. 지역 단계는 일부러 만든다:
// 아무도 다니지 않는 학과를 희망하고, 지망 캠퍼스와 같은 지역에만 선배가 있는 멘티.
const regionMentor = MOCK_MENTORS[0];
const regionSibling = CAMPUSES_BY_REGION[regionOf(regionMentor.currentCampus)!].find(
  (c) => !MOCK_MENTORS.some((m) => m.currentCampus === c),
);
if (regionSibling) {
  const regionCase = {
    ...MOCK_MENTEES[0],
    targetCampus: [regionSibling],
    targetMajors: ["검증용없는학과"],
  };
  const regionResults = recommendMentors(regionCase, MOCK_MENTORS, 50);
  check(
    "학과가 겹치는 선배가 없으면 같은 지역 선배로 넘어감",
    regionResults.length > 0 &&
      regionResults.every(
        (r) =>
          r.fallback === "REGION" &&
          regionOf(r.mentor.currentCampus) === regionOf(regionSibling),
      ) &&
      regionResults.some((r) => r.mentor.id === regionMentor.id),
    `${regionSibling} 지망 → ${regionResults.length}명`,
  );
}
check(
  "학과도 지역도 겹치지 않으면 추천하지 않음",
  recommendMentors(
    { ...MOCK_MENTEES[0], targetCampus: ["제주대"], targetMajors: ["검증용없는학과"] },
    MOCK_MENTORS.filter((m) => regionOf(m.currentCampus) !== "제주"),
    5,
  ).length === 0,
);

const stillEmpty = MOCK_MENTEES.filter((_, i) => recommended[i].length === 0);
console.log(
  `  대체 후보로 추천받은 멘티: ${noMatch.length - stillEmpty.length}/${noMatch.length}` +
    ` (학과 ${fallbackPairs.filter(({ r }) => r.fallback === "MAJOR").length}건 · ` +
    `지역 ${fallbackPairs.filter(({ r }) => r.fallback === "REGION").length}건)`,
);
if (stillEmpty.length > 0) {
  console.log(`  대체 후보도 없는 멘티: ${stillEmpty.map((m) => m.id).join(", ")}`);
}

// ---------------------------------------------------------------- 모집 필요 캠퍼스
console.log("\n[5-2] 멘토 모집이 필요한 캠퍼스");

const noAssignments = new Map<string, number>();
const demand = campusDemand(MOCK_MENTEES, MOCK_MENTORS, noAssignments, new Set());
// 매칭이 같은 성별끼리라 모집 수요도 캠퍼스·성별 쌍으로 센다.
const slot = (campus: string, gender: string | undefined) => `${campus}|${gender}`;
const mentorSlots = new Set(MOCK_MENTORS.map((m) => slot(m.currentCampus, m.gender)));
const wantedSlots = new Set(
  MOCK_MENTEES.flatMap((m) => m.targetCampus.map((c) => slot(c, m.gender))),
);

check(
  "배정이 없으면 '같은 성별 멘토 없는 지망 캠퍼스'와 정확히 일치",
  demand.map((d) => slot(d.campus, d.gender)).sort().join() ===
    [...wantedSlots].filter((k) => !mentorSlots.has(k)).sort().join(),
);
check(
  "지망한 후배가 많은 캠퍼스가 위",
  demand.every((d, i) => i === 0 || demand[i - 1].anyChoice >= d.anyChoice),
);
check(
  "1지망 수는 전체 지망 수를 넘지 않음",
  demand.every((d) => d.firstChoice <= d.anyChoice),
);
check(
  "성별이 비어 있는 멘티는 수요에 들어가지 않음",
  campusDemand(
    MOCK_MENTEES.map((m) => ({ ...m, gender: undefined })),
    MOCK_MENTORS,
    noAssignments,
    new Set(),
  ).length === 0,
);

// 같은 성별 후배가 지망한 캠퍼스에 그 성별 멘토가 한 명뿐인 곳을 골라 정원을 채우면 표에 나타나야 한다.
const soleMentor = MOCK_MENTORS.find(
  (m) =>
    wantedSlots.has(slot(m.currentCampus, m.gender)) &&
    MOCK_MENTORS.filter((o) => slot(o.currentCampus, o.gender) === slot(m.currentCampus, m.gender))
      .length === 1,
);
if (soleMentor) {
  const isSole = (d: { campus: string; gender: string }) =>
    d.campus === soleMentor.currentCampus && d.gender === soleMentor.gender;
  const full = campusDemand(
    MOCK_MENTEES,
    MOCK_MENTORS,
    new Map([[soleMentor.id, soleMentor.capacity]]),
    new Set(),
  );
  check(
    "정원이 다 찬 캠퍼스는 '정원 마감'으로 포함",
    full.find(isSole)?.mentors === 1,
    `${soleMentor.currentCampus} ${soleMentor.gender}`,
  );

  const oneLeft = campusDemand(
    MOCK_MENTEES,
    MOCK_MENTORS,
    new Map([[soleMentor.id, soleMentor.capacity - 1]]),
    new Set(),
  );
  check("한 자리라도 남으면 포함하지 않음", !oneLeft.some(isSole));
}
check(
  "선배를 고른 멘티의 지망은 수요에서 빠짐",
  campusDemand(MOCK_MENTEES, MOCK_MENTORS, noAssignments, new Set(MOCK_MENTEES.map((m) => m.id)))
    .length === 0,
);

console.log(`  모집 필요 캠퍼스: ${demand.length}곳`);
for (const d of demand.slice(0, 5)) {
  console.log(`    ${d.campus} (${d.region ?? "-"}) — 지망 ${d.anyChoice}명 · 1지망 ${d.firstChoice}명`);
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
check("성경 인물을 고른 멘토는 성향 해시태그 보유",
  MOCK_MENTORS.every((mentor) =>
    !mentor.personaType ||
    buildHashtags(mentor, MOCK_MENTEES[0]).includes(PERSONAS[mentor.personaType].hashtag),
  ),
);
check("성경 인물을 '잘 모르겠어요'로 둔 멘토는 성향 태그 없이도 카드가 만들어짐",
  buildHashtags({ ...MOCK_MENTORS[0], personaType: undefined }, MOCK_MENTEES[0])
    .every((t) => t.startsWith("#") && !t.endsWith("형")),
);
check("한쪽이라도 '잘 모르겠어요'면 성향 점수는 상대와 무관하게 같음",
  new Set(
    MOCK_MENTORS.map((mentor) =>
      scorePersona({ ...MOCK_MENTEES[0], personaType: undefined }, mentor),
    ),
  ).size === 1 &&
    scorePersona(MOCK_MENTEES[0], { ...MOCK_MENTORS[0], personaType: undefined }) ===
      WEIGHTS.persona * 0.5,
);

// ---------------------------------------------------------------- 샘플 출력
console.log("\n[7] 샘플 매칭 결과 (멘티 3명)");

for (const mentee of MOCK_MENTEES.slice(0, 3)) {
  console.log(
    `\n  ▸ ${mentee.name}(${mentee.id}) | 지망: ${mentee.targetCampus.join(" > ")}`,
  );
  console.log(
    `    관심영역: ${mentee.desiredAreas.join(", ")} | 성향: ${mentee.personaType ? PERSONAS[mentee.personaType].name : "모름"} | ` +
      `목표: ${mentee.targetMajors.join(", ")} / ${mentee.targetCareers.join(", ")}`,
  );
  console.log(`    성별: ${mentee.gender}`);

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
      `           캠퍼스 ${b.campus.toFixed(1)} / 영역 ${b.area.toFixed(1)} / ` +
        `MBTI ${b.mbti.toFixed(1)} / 학과·진로 ${b.majorAndCareer.toFixed(1)} / 성경인물 ${b.persona.toFixed(1)}`,
    );
  }
}

console.log("\n" + "=".repeat(64));
console.log(failures === 0 ? "모든 검증 통과" : `${failures}건 실패`);
console.log("=".repeat(64));

process.exit(failures === 0 ? 0 : 1);
