import { NextResponse } from "next/server";
import { findMenteeForMentor } from "@/features/signup/lib/repository";
import {
  isValidParticipationCode,
  normalizeParticipationCode,
} from "@/features/onboarding/lib/participationCode";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 멘토가 자기에게 연결된 후배를 확인한다.
 *
 * 연락처를 돌려주는 통로라 속도 제한을 빡빡하게 건다. 참여코드는 6자리
 * (31^6 ≈ 8.9억 조합)라 무작위로 맞히기는 어렵지만, 제한이 없으면
 * 시도 자체를 막을 수 없다.
 */
const MAX_CHECKS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "mentor-match"), MAX_CHECKS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let code = "";
  try {
    const body = (await request.json()) as { participationCode?: unknown };
    code = normalizeParticipationCode(String(body.participationCode ?? ""));
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!isValidParticipationCode(code)) {
    return NextResponse.json({ error: "참여코드를 확인해주세요." }, { status: 400 });
  }

  const result = await findMenteeForMentor(code);
  if (!result) {
    // 멘티 코드로 들어온 경우도 여기로 떨어진다. 어느 쪽인지 알려주지 않는 편이
    // 낫다 — "이 코드는 멘토가 아니다"는 것도 알려주지 않아야 할 정보다.
    return NextResponse.json(
      { error: "멘토 참여코드를 찾지 못했어요. 코드를 다시 확인해주세요." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
