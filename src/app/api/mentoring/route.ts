import { NextResponse } from "next/server";
import { applyMentoring } from "@/features/signup/lib/repository";
import { validateMentoring } from "@/features/signup/lib/validate";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import {
  isValidParticipationCode,
  normalizeParticipationCode,
} from "@/features/onboarding/lib/participationCode";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 2단계 — 멘토링 신청.
 *
 * 행사 등록으로 이미 만들어진 행에 관심사·학교를 덧붙인다.
 * 본인 확인은 참여코드로 한다. 이름·연락처를 다시 받으면
 * 남의 등록에 멘토링을 붙일 수 있다.
 */

const MAX_REQUESTS = 600;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "mentoring"), MAX_REQUESTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "서버가 아직 연결되지 않았어요. 운영자에게 문의해주세요." },
      { status: 503 },
    );
  }

  let role: "MENTEE" | "MENTOR";
  let draft: OnboardingDraft;
  let code: string;
  try {
    const body = (await request.json()) as {
      role?: unknown;
      draft?: unknown;
      participationCode?: unknown;
    };
    if (body.role !== "MENTEE" && body.role !== "MENTOR") {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    role = body.role;
    draft = body.draft as OnboardingDraft;
    code = normalizeParticipationCode(String(body.participationCode ?? ""));
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // 참여코드가 없거나 맞지 않으면 401 과 NOT_REGISTERED 를 돌려준다. 입력값 오류(400)와 구분해야
  // 신청 화면이 오류만 띄우지 않고 조회 화면으로 보내 등록 정보를 다시 찾게 할 수 있다.
  if (!isValidParticipationCode(code)) {
    return NextResponse.json(
      { error: "등록 정보를 찾지 못했어요. 참여코드를 다시 찾아주세요.", reason: "NOT_REGISTERED" },
      { status: 401 },
    );
  }

  const invalid = validateMentoring(role, draft);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const result = await applyMentoring(role, code, draft);
  if (!result.ok) {
    if (result.reason === "NOT_REGISTERED") {
      return NextResponse.json({ error: result.error, reason: result.reason }, { status: 401 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 로그에는 참여코드만 남긴다. 이름·연락처를 찍으면 로그가 개인정보 파일이 된다.
  console.log(`[mentoring] ${role} ${code}`);
  return NextResponse.json({ participationCode: code });
}
