import { NextResponse } from "next/server";
import { findCodeByNameAndContact } from "@/features/signup/lib/repository";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";

/**
 * 참여코드 조회.
 *
 * 이 엔드포인트는 "이 사람이 신청했는가"를 확인해 주는 통로이기도 하다.
 * 이름과 번호를 바꿔가며 호출하면 특정인의 신청 여부를 캐낼 수 있으므로
 * 속도 제한을 다른 곳보다 빡빡하게 건다.
 */
const MAX_LOOKUPS = 8;
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
  });
}
