import { RoleFunnel } from "@/features/onboarding/components/RoleFunnel";

/** 1단계 — 행사 등록. 멘토링을 하지 않아도 여기까지는 모두 거친다. */
export default function MentorRegisterPage() {
  return <RoleFunnel role="MENTOR" phase="register" />;
}
