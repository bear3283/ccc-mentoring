import { RoleFunnel } from "@/features/onboarding/components/RoleFunnel";

/** 2단계 — 멘토링 신청. 행사 등록을 마친 사람만 들어온다. */
export default function MentorMentoringPage() {
  return <RoleFunnel role="MENTOR" phase="mentoring" />;
}
