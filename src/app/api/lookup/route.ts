import { NextResponse } from "next/server";
import { findCodeByNameAndContact } from "@/features/signup/lib/repository";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";

/**
 * 참여코드 조회.
 *
 * 이 엔드포인트는 "이 사람이 신청했는가"를 확인해 주는 통로이기도 하다.
 * 이름과 번호를 바꿔가며 호출하면 특정인의 신청 여부를 캐낼 수 있으므로
 * 속도 제한을 건다.
 *
 * 한도는 "한 사람"이 아니라 "한 네트워크" 기준이다. 채플 당일 행사장 Wi-Fi 에서는 수백 명이
 * 밖에서 보면 IP 하나이고, 멘토링 신청 QR·링크로 들어온 사람도 모두 이 조회를 거친다.
 * 예전 값(100회/10분)으로는 현장에서 막힐 수 있어 올렸다. 이름과 번호가 둘 다 맞아야
 * 찾아지므로 이 정도로는 특정인의 신청 여부를 훑어 캐내기에 여전히 턱없이 모자란다.
 */
const MAX_LOOKUPS = 400;
const WINDOW_MS = 10 * 60 * 1000;

/** 입력한 대로 하이픈을 맞춰 DB의 저장 형식과 일치시킨다. */
function normalizeContact(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 10) return "";
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "lookup"), MAX_LOOKUPS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  let name = "";
  let contact = "";
  try {
    const body = (await request.json()) as { name?: unknown; contact?: unknown };
    name = String(body.name ?? "").trim();
    contact = normalizeContact(String(body.contact ?? ""));
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (name.length < 2 || !contact) {
    return NextResponse.json({ error: "이름과 연락처를 확인해주세요." }, { status: 400 });
  }

  const found = await findCodeByNameAndContact(name, contact);

  // 찾지 못한 이유(이름이 틀렸는지, 번호가 틀렸는지)는 알려주지 않는다.
  // 구분해서 알려주면 이름만으로 가입 여부를 확인하는 데 쓸 수 있다.
  if (!found) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    participationCode: found.code,
    name: found.name,
    role: found.role,
    mentoringApplied: found.mentoringApplied,
    // 이름·번호를 둘 다 맞힌 본인에게만 간다. 멘토링 신청 화면이 등록을 다시 묻지 않고 이어 쓴다.
    resume: found.resume,
  });
}
