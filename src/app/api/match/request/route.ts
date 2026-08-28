import { NextResponse } from "next/server";
import { requestMatch } from "@/features/signup/lib/repository";
import {
  isValidParticipationCode,
  normalizeParticipationCode,
} from "@/features/onboarding/lib/participationCode";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";

/**
 * 매칭 요청 = 멘토 연락처가 공개되는 지점.
 *
 * 여기가 개인정보가 실제로 넘어가는 유일한 문이라, 조건을 좁게 건다.
 *  - 참여코드의 주인만 요청할 수 있다
 *  - 이미 계산되어 저장된 매칭 상대에게만 요청할 수 있다
 *    (아무 멘토 id나 넣어 연락처를 캐내는 것을 막는다)
 *  - 요청 기록이 남아 운영자가 누가 누구에게 연락했는지 볼 수 있다
 */

/** 한 멘티가 받는 상대는 3명뿐이므로 넉넉해도 이 정도면 충분하다. */
const MAX_REQUESTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "match-request"), MAX_REQUESTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  let code: string;
  let mentorId: string;
  try {
    const body = (await request.json()) as {
      participationCode?: unknown;
      mentorId?: unknown;
    };
    code = normalizeParticipationCode(String(body.participationCode ?? ""));
    mentorId = String(body.mentorId ?? "");
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!isValidParticipationCode(code) || !mentorId) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await requestMatch(code, mentorId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 누가 누구에게 요청했는지는 참여코드로만 남긴다.
  console.log(`[match] request ${code} -> ${mentorId.slice(0, 8)}`);

  return NextResponse.json({ contact: result.contact, mentorName: result.mentorName });
}
