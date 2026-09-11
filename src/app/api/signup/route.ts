import { NextResponse } from "next/server";
import { findExistingSignup, saveSignup } from "@/features/signup/lib/repository";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import { generateParticipationCode } from "@/features/onboarding/lib/participationCode";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";
import { validateRegistration } from "@/features/signup/lib/validate";

/**
 * 신청서 저장.
 *
 * 참여코드는 클라이언트가 보낸 값을 믿지 않고 서버에서 발급한다.
 * 브라우저가 정한 코드를 그대로 쓰면 원하는 코드를 골라 넣거나
 * 남의 코드와 충돌시키는 요청을 만들 수 있다.
 */

/**
 * 속도 제한을 두 단계로 나눈다.
 *
 * 막으려는 것은 "대량 등록"이지 "오타"가 아니다. 실패한 시도까지 한 칸에 세면
 * 연락처를 잘못 적은 사람이 몇 번 만에 차단되어 신청을 못 한다.
 *
 *  - 요청 자체: 넉넉하게. 무한 호출만 막는다
 *  - 실제 저장: 빡빡하게. 여기가 계정이 생기는 지점이다
 */
const MAX_ATTEMPTS = 30;
const MAX_SIGNUPS = 5;
const WINDOW_MS = 10 * 60 * 1000;

/** 코드가 겹치면 다시 뽑는다. 31^6 조합이라 사실상 한 번에 끝난다. */
const MAX_CODE_RETRIES = 5;

export async function POST(request: Request) {
  const attempts = rateLimit(clientKey(request, "signup-attempt"), MAX_ATTEMPTS, WINDOW_MS);
  if (!attempts.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(attempts.retryAfterSeconds) },
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
  try {
    const body = (await request.json()) as { role?: unknown; draft?: unknown };
    if (body.role !== "MENTEE" && body.role !== "MENTOR") {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    role = body.role;
    draft = body.draft as OnboardingDraft;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // 여기서는 행사 등록만 본다. 멘토링 항목은 2단계에서 검증한다.
  const invalid = validateRegistration(role, draft);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  // 이미 신청한 사람은 새 행을 만들지 않으므로 저장 칸을 쓰지 않는다.
  // 대량 등록을 막으려는 제한인데, 재제출한 사람의 몫까지 깎으면
  // 같은 사람이 몇 번 더 눌렀다는 이유로 차단된다.
  const existing = await findExistingSignup(role, draft.name ?? "", draft.contact ?? "");
  if (existing) {
    if (!existing.sameName) {
      return NextResponse.json(
        { error: "이미 등록된 연락처예요. 번호를 다시 확인해주세요." },
        { status: 400 },
      );
    }
    console.log(`[signup] ${role} duplicate -> ${existing.code}`);
    return NextResponse.json({ participationCode: existing.code, alreadyRegistered: true });
  }

  // 실제로 새 행을 만드는 요청만 저장 칸을 쓴다.
  const saves = rateLimit(clientKey(request, "signup-save"), MAX_SIGNUPS, WINDOW_MS);
  if (!saves.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(saves.retryAfterSeconds) },
      { status: 429 },
    );
  }

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const participationCode = generateParticipationCode();
    const result = await saveSignup(role, draft, participationCode);

    if (result.ok) {
      // 로그에는 참여코드만 남긴다. 이름·연락처를 찍으면 로그가 개인정보 파일이 된다.
      console.log(`[signup] ${role} ${participationCode}`);
      return NextResponse.json({ participationCode });
    }

    // 이미 신청한 본인이면 기존 코드를 돌려준다.
    // 실수로 두 번 제출한 사람에게 오류를 보여주는 것보다,
    // "이미 신청하셨어요" 와 함께 코드를 다시 알려주는 편이 실제로 필요한 응답이다.
    if (result.existingCode) {
      console.log(`[signup] ${role} duplicate -> ${result.existingCode}`);
      return NextResponse.json({
        participationCode: result.existingCode,
        alreadyRegistered: true,
      });
    }

    // 참여코드 충돌이면 다시 뽑아 재시도하고, 그 외 오류는 즉시 알린다.
    if (!result.error?.includes("코드가 중복")) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  return NextResponse.json(
    { error: "코드를 발급하지 못했어요. 잠시 후 다시 시도해주세요." },
    { status: 500 },
  );
}
