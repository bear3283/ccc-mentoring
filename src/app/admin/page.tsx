import { AdminDashboard, type MatchRow } from "@/features/admin/components/AdminDashboard";
import { campusDemand } from "@/features/admin/lib/campusDemand";
import {
  listMatchings,
  listMentees,
  listMentorNotices,
  listMentors,
  listUnmatched,
  loadAssignmentState,
} from "@/features/signup/lib/repository";

/**
 * 운영자 화면.
 *
 * 서버 컴포넌트에서 직접 DB를 읽는다. 별도 API 라우트를 두지 않는 이유:
 * 그 라우트가 곧 "신청자 전원의 연락처를 돌려주는 공개 엔드포인트"가 되어
 * 미들웨어 말고도 지켜야 할 문이 하나 늘어난다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다.
 */

// 신청이 계속 들어오므로 매번 새로 읽는다.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 질의는 서로 의존하지 않으므로 함께 보낸다.
  const [mentees, mentors, matchings, unmatched, assignment, notices] = await Promise.all([
    listMentees(),
    listMentors(),
    listMatchings(),
    listUnmatched(),
    loadAssignmentState(),
    listMentorNotices(),
  ]);

  const matchRows: MatchRow[] = matchings.map((m) => ({
    id: `${m.menteeCode}-${m.mentorCode}`,
    rank: m.rank,
    menteeCode: m.menteeCode,
    menteeName: m.menteeName,
    menteeCampus: m.menteeCampus,
    menteeArea: "-",
    mentorName: m.mentorName,
    mentorCampus: m.mentorCampus,
    score: m.score,
    campusScore: round1(m.breakdown?.campus),
    areaScore: round1(m.breakdown?.area),
    scheduleScore: round1(m.breakdown?.schedule),
    mbtiScore: round1(m.breakdown?.mbti),
    personaScore: round1(m.breakdown?.persona),
    majorScore: round1(m.breakdown?.majorAndCareer),
    contact: m.mentorContact,
    status: m.status,
    fallback: m.fallback,
  }));

  // 클라이언트 컴포넌트로는 Map 을 넘길 수 없어 멘토 행에 바로 붙인다.
  const mentorRows = mentors.map((m) => ({
    ...m,
    assigned: assignment.activeByMentor.get(m.id) ?? 0,
  }));

  return (
    <AdminDashboard
      mentees={mentees}
      mentors={mentorRows}
      matchRows={matchRows}
      unmatched={unmatched}
      notices={notices}
      demand={campusDemand(
        mentees,
        mentors,
        assignment.activeByMentor,
        assignment.settledMentees,
      )}
    />
  );
}

function round1(value: number | undefined): number {
  return Math.round((value ?? 0) * 10) / 10;
}
