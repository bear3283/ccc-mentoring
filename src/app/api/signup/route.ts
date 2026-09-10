import { NextResponse } from "next/server";
import { saveSignup } from "@/features/signup/lib/repository";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import { generateParticipationCode } from "@/features/onboarding/lib/participationCode";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";
import { CONSENT_VERSION } from "@/shared/constants/privacy";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

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

  const invalid = validateDraft(role, draft);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  // 검증을 통과한 뒤에야 "저장 시도" 한 칸을 쓴다.
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

/**
 * 서버에서 다시 검증한다.
 * 브라우저 검증은 사용자를 돕는 장치일 뿐, 요청을 직접 만들면 그냥 우회된다.
 */
function validateDraft(role: "MENTEE" | "MENTOR", draft: OnboardingDraft): string | null {
  if (!draft) return "잘못된 요청이에요.";

  if (!draft.name || draft.name.trim().length < 2) return "이름을 확인해주세요.";
  if (draft.name.trim().length > 20) return "이름이 너무 길어요.";
  if (draft.gender !== "MALE" && draft.gender !== "FEMALE") return "성별을 확인해주세요.";
  if (!draft.contact || !/^01[016-9]-\d{3,4}-\d{4}$/.test(draft.contact)) {
    return "연락처 형식을 확인해주세요.";
  }
  if (!draft.personaType) return "성향을 골라주세요.";

  // 동의는 브라우저에서 체크박스를 지나쳐도 서버가 다시 막는다.
  if (!draft.consentedAt || !draft.consentVersion) {
    return "개인정보 동의가 필요해요.";
  }
  if (draft.consentVersion !== CONSENT_VERSION) {
    return "동의 문구가 변경되었어요. 화면을 새로고침한 뒤 다시 시도해주세요.";
  }
  if (draft.availableTimes.length === 0) return "가능한 시간을 골라주세요.";

  if (role === "MENTEE") {
    if (draft.targetCampus.length < 1 || draft.targetCampus.length > 3) {
      return "지망 캠퍼스를 확인해주세요.";
    }
    if (draft.desiredAreas.length < 1 || draft.desiredAreas.length > 3) {
      return "관심 분야를 확인해주세요.";
    }
    if (draft.targetMajors.length < 1 || draft.targetMajors.length > 3) {
      return "희망 학과를 확인해주세요.";
    }
    if (draft.targetCareers.length < 1 || draft.targetCareers.length > 3) {
      return "희망 진로를 확인해주세요.";
    }
  } else {
    if (!draft.currentCampus) return "캠퍼스를 골라주세요.";
    if (!draft.admissionYear) return "학번을 골라주세요.";
    if (draft.mentoringArea.length < 1) return "도와줄 영역을 골라주세요.";
    if (draft.currentMajors.length < 1 || draft.currentMajors.length > 3) {
      return "전공을 확인해주세요.";
    }
    if (draft.careerPaths.length < 1 || draft.careerPaths.length > 3) {
      return "진로를 확인해주세요.";
    }
  }

  // 사진은 data URL로 들어온다. 지나치게 크면 저장소와 응답이 함께 무거워진다.
  if (draft.photoUrl && draft.photoUrl.length > 400_000) {
    return "사진 용량이 너무 커요.";
  }

  return null;
}
