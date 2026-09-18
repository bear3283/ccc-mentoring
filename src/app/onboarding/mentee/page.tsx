import { redirect } from "next/navigation";

/**
 * 예전 경로. 등록이 역할과 무관해지면서 /onboarding/register 로 합쳤다.
 * 이미 나간 QR·링크가 있을 수 있어 경로 자체는 남겨 둔다.
 */
export default function LegacyMenteeRegisterPage() {
  redirect("/onboarding/register");
}
