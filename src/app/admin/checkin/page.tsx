import { cookies } from "next/headers";
import { CheckInDesk } from "@/features/admin/components/CheckInDesk";
import { countAttendance } from "@/features/signup/lib/repository";
import { ADMIN_COOKIE, verifySessionValue } from "@/shared/lib/security/adminSession";

/**
 * 채플 당일 입구 출석 체크.
 *
 * 입구 운영자가 휴대폰으로 연다. 참가자가 참여코드를 보여주거나 이름을 말하면
 * 찾아서 대학생인지 고3인지 확인하고 출석을 찍는다.
 *
 * 운영자·보기 전용 비밀번호 말고 출석 전용 비밀번호(CHECKIN_PASSWORD)로도 들어온다.
 * 그 계정은 이 화면만 쓸 수 있다. 접근 제어는 src/middleware.ts 가 담당한다.
 */
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const role = await verifySessionValue(
    (await cookies()).get(ADMIN_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET ?? "",
  );
  const counts = await countAttendance();
  // 출석 전용 계정(checkin)도 출석은 찍는다. 막는 것은 보기 전용뿐이다.
  return (
    <CheckInDesk
      readOnly={role === "viewer"}
      checkInOnly={role === "checkin"}
      initialCounts={counts}
    />
  );
}
