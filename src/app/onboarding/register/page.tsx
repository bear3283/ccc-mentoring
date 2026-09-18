import { RoleFunnel } from "@/features/onboarding/components/RoleFunnel";

/**
 * 1단계 — 고3채플 등록.
 *
 * 고3이든 대학생이든 모두 같은 질문을 받는다. 역할은 이 안의 한 스텝으로
 * 물어보므로 경로에 담지 않는다.
 */
export default function RegisterPage() {
  return <RoleFunnel phase="register" />;
}
