import "server-only";

import type { FallbackReason, Mentee, Mentor, ScoreBreakdown } from "@/features/matching/model/types";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import type { Role } from "@/shared/constants/role";
import type { Campus, Gender, Major, MentoringArea } from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import { isEventArrival, type EventArrival } from "@/shared/constants/venue";
import { safeForLog } from "@/shared/lib/security/mask";
import { getSupabase } from "@/shared/lib/supabase/server";
import { fallbackReason, isSameGender, recommendMentors } from "@/features/matching/lib/score";
import { MOCK_MENTEES, MOCK_MENTORS } from "@/shared/lib/mock/generate";

/**
 * 신청 데이터 저장소.
 *
 * Supabase 자격증명이 없으면 더미 명단으로 동작한다(읽기 전용).
 * 그래야 키 없이도 화면을 확인할 수 있고, 키를 채우면 그대로 실서버가 된다.
 */

type UserRole = Extract<Role, "MENTEE" | "MENTOR">;

/** DB 행 -> 앱 타입. 컬럼명이 snake_case라 한 곳에서만 변환한다. */
interface UserRow {
  id: string;
  role: UserRole;
  participation_code: string;
  name: string;
  gender: Gender | null;
  contact: string;
  persona_type: PersonaType | null;
  mbti: string | null;
  high_school: string | null;
  referrer: string | null;
  photo_url: string | null;
  church: string | null;
  is_new_friend: boolean;
  mentoring_applied: boolean;
  /** 도착 시간 컬럼을 추가하기 전의 DB에는 없다. */
  event_arrival?: string | null;
}

interface MenteeRow {
  target_campus: string[];
  desired_areas: string[];
  target_majors: string[];
  target_careers: string[];
}

interface MentorRow {
  current_campus: string;
  admission_year: number;
  mentoring_area: string[];
  current_majors: string[];
  career_paths: string[];
  /** 정원 컬럼을 추가하기 전의 DB에는 없다. 그때는 예전처럼 1명으로 본다. */
  capacity?: number;
}

/**
 * 등록만 한 사람은 프로필 행이 없다. 멘토링을 신청해야 만들어진다.
 * 운영자 표에는 그대로 보여야 해서(채플에는 오시는 분들이다) 빈 값으로 채운다.
 */
function toMentee(user: UserRow, profile: MenteeRow | null): Mentee {
  return {
    id: user.id,
    participationCode: user.participation_code,
    name: user.name,
    gender: user.gender ?? undefined,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    church: user.church ?? undefined,
    isNewFriend: user.is_new_friend ?? false,
    mentoringApplied: user.mentoring_applied ?? false,
    eventArrival: asEventArrival(user.event_arrival),
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    targetCampus: (profile?.target_campus ?? []) as Campus[],
    desiredAreas: (profile?.desired_areas ?? []) as MentoringArea[],
    personaType: user.persona_type ?? undefined,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    targetMajors: (profile?.target_majors ?? []) as Major[],
  };
}

/** toMentee 와 같은 이유로 프로필이 없을 수 있다. */
function toMentor(user: UserRow, profile: MentorRow | null): Mentor {
  return {
    id: user.id,
    participationCode: user.participation_code,
    name: user.name,
    gender: user.gender ?? undefined,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    church: user.church ?? undefined,
    isNewFriend: user.is_new_friend ?? false,
    mentoringApplied: user.mentoring_applied ?? false,
    eventArrival: asEventArrival(user.event_arrival),
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    currentCampus: profile?.current_campus as Campus,
    admissionYear: profile?.admission_year ?? 0,
    mentoringArea: (profile?.mentoring_area ?? []) as MentoringArea[],
    personaType: user.persona_type ?? undefined,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    currentMajors: (profile?.current_majors ?? []) as Major[],
    capacity: profile?.capacity ?? 1,
  };
}

/** DB 값이 고를 수 있는 값이 아니면(비었거나 옛 값) 없는 것으로 본다. */
function asEventArrival(value: string | null | undefined): EventArrival | undefined {
  return isEventArrival(value) ? value : undefined;
}

/** Supabase 가 돌려주는 오류의 모양. 전부 optional 이라 따로 적는다. */
interface DbError {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

/**
 * DB 오류를 서버 로그에 남긴다.
 *
 * 이게 없으면 저장 실패 시 로그에 "POST /api/signup 400" 한 줄만 남아,
 * 오픈 당일 무엇이 잘못됐는지 알아낼 방법이 없다. 화면에는 계속
 * 안내 문구만 보여주고, 원인은 운영자만 볼 수 있는 곳에 적는다.
 *
 * details 는 찍지 않는다 — PostgREST 는 여기에 실패한 행을 통째로 넣어 주는데,
 * 그대로 두면 이름과 연락처가 로그 파일에 쌓인다. code·message·hint 만으로도
 * 어떤 제약에 걸렸는지는 충분히 드러난다.
 */
function logDbError(where: string, error: DbError | null, who?: LogSubject): void {
  if (!error) return;
  // 누구의 요청이었는지는 참여코드로만 남긴다. 그래야 운영자가 문의받은 사람을
  // 로그에서 찾을 수 있으면서도 로그에 이름·연락처가 쌓이지 않는다.
  const subject = who ? ` [${safeForLog(who)}]` : "";
  console.error(
    `[db] ${where}${subject} 실패 — code=${error.code ?? "?"} ${error.message ?? ""}` +
      (error.hint ? ` (hint: ${error.hint})` : ""),
  );
}

type LogSubject = Parameters<typeof safeForLog>[0];

export interface SaveResult {
  ok: boolean;
  userId?: string;
  /** 실패 사유. 화면에 그대로 보여줄 수 있는 한국어 문장. */
  error?: string;
  /**
   * 이미 신청한 사람이라 새로 만들지 않고 기존 코드를 돌려준 경우.
   * 실수로 두 번 제출한 사람에게 오류를 보여주는 대신 코드를 다시 알려준다.
   */
  existingCode?: string;
}

/**
 * 같은 연락처로 이미 등록했는지 본다. 고3·대학생을 가리지 않는다.
 *
 * DB 유니크 제약은 (연락처, 역할) 이라 같은 번호로 고3과 대학생을 하나씩
 * 등록할 수 있다. 한 사람이 양쪽으로 등록하면 명단이 부풀고, 남의 번호를
 * 잘못 적은 경우에는 엉뚱한 사람에게 매칭 문자가 간다. 그래서 역할과
 * 상관없이 번호 하나에 등록 하나만 받는다.
 *
 * 같은 역할에 이름까지 같으면 본인이 다시 제출한 것으로 보고 기존 코드를
 * 돌려준다. 그 밖에는 코드를 알려주지 않고 막는다.
 */
export async function findExistingSignup(
  role: UserRole,
  name: string,
  contact: string,
): Promise<{ sameRole: boolean; sameName: boolean; code: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("users")
    .select("participation_code, name, role")
    .eq("contact", contact);

  // 조회가 실패하면 "처음 신청하는 사람"으로 읽혀 중복 확인이 통째로 건너뛰어진다.
  if (error) logDbError("중복 신청 확인", error);
  if (!data || data.length === 0) return null;

  // 예전 규칙으로 양쪽에 하나씩 있을 수 있다. 같은 역할 행을 먼저 본다.
  const hit = data.find((row) => row.role === role) ?? data[0];
  return {
    sameRole: hit.role === role,
    sameName: (hit.name as string).trim() === name.trim(),
    code: hit.participation_code as string,
  };
}

/**
 * 이미 있는 등록을 어떻게 안내할지. undefined 면 본인의 재제출이라 기존 코드를 돌려준다.
 * 등록 라우트와 saveSignup 이 같은 문구를 쓰도록 한곳에 둔다.
 */
export function duplicateSignupError(
  role: UserRole,
  existing: { sameRole: boolean; sameName: boolean },
): string | undefined {
  if (existing.sameRole && existing.sameName) return undefined;
  if (existing.sameRole) return "이미 등록된 연락처예요. 번호를 다시 확인해주세요.";
  return role === "MENTOR"
    ? "이 번호는 고3으로 이미 등록되어 있어요. 번호를 다시 확인해주세요."
    : "이 번호는 대학생으로 이미 등록되어 있어요. 번호를 다시 확인해주세요.";
}

/** 신청서를 저장한다. users 행을 만들고 역할별 프로필을 잇는다. */
export async function saveSignup(
  role: UserRole,
  draft: OnboardingDraft,
  participationCode: string,
): Promise<SaveResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "서버가 아직 연결되지 않았어요. 운영자에게 문의해주세요." };
  }

  // 중복 신청 확인이 먼저다. 새 행을 만든 뒤 유니크 제약에 걸리면
  // 참여코드만 낭비되고 사용자는 원인을 알 수 없는 오류를 본다.
  const existing = await findExistingSignup(role, draft.name ?? "", draft.contact ?? "");
  if (existing) {
    const error = duplicateSignupError(role, existing);
    return error ? { ok: false, error } : { ok: false, existingCode: existing.code };
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      role,
      participation_code: participationCode,
      name: draft.name,
      gender: draft.gender ?? null,
      contact: draft.contact,
      // 출석 교회는 묻지 않는다(민감정보). 화면을 거치지 않은 요청이 보내도 저장하지 않는다.
      church: null,
      is_new_friend: false,
      // 멘토링을 신청하지 않은 등록자는 아래 값들이 비어 있다.
      mentoring_applied: draft.mentoringApplied ?? false,
      persona_type: draft.personaType ?? null,
      mbti: draft.mbti ?? null,
      high_school: draft.highSchool ?? null,
      referrer: draft.referrer ?? null,
      photo_url: draft.photoUrl ?? null,
      consented_at: draft.consentedAt,
      consent_version: draft.consentVersion,
    })
    .select("id")
    .single();

  if (userError || !user) {
    // 참여코드가 겹치는 건 사실상 없지만(31^6 조합), 겹치면 재발급이 필요하다.
    // 이건 정상 경로라 로그를 남기지 않는다 — 호출부가 코드를 다시 뽑아 재시도한다.
    if (userError?.code === "23505") {
      // 같은 번호가 동시에 두 번 들어온 경우. 위의 중복 확인을 지나쳐 DB 제약에 걸렸다.
      // 코드를 다시 뽑아도 소용없으니 재시도로 넘기지 않는다.
      if (userError.message?.includes("users_contact")) {
        return { ok: false, error: "이미 등록된 연락처예요. 번호를 다시 확인해주세요." };
      }
      return { ok: false, error: "코드가 중복되었어요. 다시 시도해주세요.", };
    }
    logDbError(`등록 저장 (${role})`, userError, { participationCode });
    return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  /*
   * 프로필(mentee_profiles / mentor_profiles)은 여기서 만들지 않는다.
   *
   * 등록만 하는 사람은 캠퍼스·관심사를 답하지 않는데, 두 테이블 모두
   * 그 값들이 NOT NULL 이라 빈 행을 넣을 수 없다. 프로필은 매칭에 쓰는
   * 정보이므로 멘토링을 신청하는 2단계에서 한 번에 만든다.
   */
  return { ok: true, userId: user.id };
}

/**
 * 성사된 매칭(REQUESTED/CONFIRMED)으로 본 현재 배정 상태.
 *
 * 추천(SUGGESTED)만 된 상태는 아직 성사가 아니므로 세지 않는다.
 * 세면 첫 멘티가 결과를 여는 순간 멘토 3명의 자리가 잠긴다.
 */
export interface AssignmentState {
  /** 멘토 id → 이미 맡은 후배 수 */
  activeByMentor: Map<string, number>;
  /** 이미 선배를 고른 멘티 id */
  settledMentees: Set<string>;
}

export async function loadAssignmentState(): Promise<AssignmentState> {
  const state: AssignmentState = { activeByMentor: new Map(), settledMentees: new Set() };
  const supabase = getSupabase();
  if (!supabase) return state;

  const { data, error } = await supabase
    .from("matchings")
    .select("mentee_id, mentor_id")
    .in("status", ["REQUESTED", "CONFIRMED"]);

  // 조회가 실패하면 모든 멘토가 빈자리로 보인다. 정원은 DB 트리거가 지키지만
  // 후보 목록이 틀어지므로 드러나야 한다.
  if (error) logDbError("배정 상태 조회", error);

  for (const row of data ?? []) {
    const mentorId = row.mentor_id as string;
    state.activeByMentor.set(mentorId, (state.activeByMentor.get(mentorId) ?? 0) + 1);
    state.settledMentees.add(row.mentee_id as string);
  }
  return state;
}

/** 아직 자리가 남은 멘토인지. 정원은 멘토가 신청할 때 고른다. */
function hasOpenSeat(mentor: Mentor, state: AssignmentState): boolean {
  return (state.activeByMentor.get(mentor.id) ?? 0) < mentor.capacity;
}

/**
 * 2단계 — 이미 등록한 사람에게 멘토링 정보를 덧붙인다.
 *
 * 새 행을 만들지 않고 기존 행을 갱신한다. 참여코드로 본인을 확인하므로
 * 이름·연락처를 다시 받지 않는다 — 그러면 남의 등록에 붙일 수 있다.
 */
export async function applyMentoring(
  role: UserRole,
  participationCode: string,
  draft: OnboardingDraft,
): Promise<SaveResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "서버가 아직 연결되지 않았어요. 운영자에게 문의해주세요." };
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, role, mentoring_applied")
    .eq("participation_code", participationCode)
    .maybeSingle();

  if (!user) return { ok: false, error: "등록 내역을 찾지 못했어요." };

  // 멘티로 등록해 놓고 멘토 신청서를 밀어 넣는 것을 막는다.
  if (user.role !== role) {
    return { ok: false, error: "등록하신 역할과 달라요. 처음부터 다시 시도해주세요." };
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      mentoring_applied: true,
      // 등록 때 받았으면 같은 값이고, 성별을 받기 전 등록자는 여기서 처음 채워진다.
      gender: draft.gender,
      // "잘 모르겠어요"면 비운다. 다시 신청하며 바꾼 경우도 그대로 반영한다.
      persona_type: draft.personaType ?? null,
      mbti: draft.mbti ?? null,
      photo_url: draft.photoUrl ?? null,
      // 채플이 지난 뒤에는 묻지 않는다. 다시 신청하며 비워 낸 경우도 그대로 비운다.
      event_arrival: draft.eventArrival ?? null,
    })
    .eq("id", user.id);

  if (userError) {
    logDbError(`멘토링 신청 - users 갱신 (${role})`, userError, { participationCode });
    return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  /*
   * 프로필은 여기서 처음 만들어진다. 등록 단계에서는 캠퍼스를 묻지 않기 때문이다.
   *
   * upsert 를 쓰는 이유: 2단계를 마친 사람이 다시 들어와 고쳐 낼 수 있다.
   * insert 로 두면 두 번째 제출이 user_id 유니크 제약에 걸려 실패한다.
   */
  const profileError =
    role === "MENTEE"
      ? (
          await supabase.from("mentee_profiles").upsert(
            {
              user_id: user.id,
              target_campus: draft.targetCampus,
              desired_areas: draft.desiredAreas,
              target_majors: draft.targetMajors,
              // 진로는 묻지 않는다. 컬럼은 이전 신청자의 값 때문에 남겨 두고 비운다.
              target_careers: [],
            },
            { onConflict: "user_id" },
          )
        ).error
      : (
          await supabase.from("mentor_profiles").upsert(
            {
              user_id: user.id,
              current_campus: draft.currentCampus,
              admission_year: draft.admissionYear,
              mentoring_area: draft.mentoringArea,
              current_majors: draft.currentMajors,
              career_paths: [],
              // 예전 화면에서 온 신청에는 값이 없다. DB 기본값과 같은 1명으로 둔다.
              capacity: draft.mentorCapacity ?? 1,
            },
            { onConflict: "user_id" },
          )
        ).error;

  if (profileError) {
    logDbError(`멘토링 신청 - 프로필 저장 (${role})`, profileError, { participationCode });
    // users 는 이미 갱신됐으므로 멘토링 표시를 되돌린다.
    // 그대로 두면 관심사가 빈 채로 매칭 후보에 올라간다.
    const { error: rollbackError } = await supabase
      .from("users")
      .update({ mentoring_applied: false })
      .eq("id", user.id);
    // 되돌리기까지 실패하면 관심사 없는 사람이 매칭 후보에 남는다. 꼭 드러나야 한다.
    if (rollbackError) logDbError("멘토링 표시 되돌리기", rollbackError, { participationCode });
    return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  return { ok: true, userId: user.id };
}

/**
 * 이 멘티가 이미 성사시킨 매칭. 없으면 undefined.
 *
 * 매칭을 마친 멘티가 결과 화면을 다시 열면, 줄어든 후보로 재계산되어
 * 정작 자기 멘토가 목록에서 사라진다. 그래서 재계산보다 이걸 먼저 본다.
 */
export async function findSettledMatch(
  menteeId: string,
): Promise<{ mentor: Mentor; score: number; breakdown: unknown } | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data } = await supabase
    .from("matchings")
    .select("mentor_id, score, breakdown")
    .eq("mentee_id", menteeId)
    .in("status", ["REQUESTED", "CONFIRMED"])
    .maybeSingle();

  if (!data) return undefined;

  const mentor = (await listMentors()).find((m) => m.id === data.mentor_id);
  if (!mentor) return undefined;

  return { mentor, score: data.score as number, breakdown: data.breakdown };
}

/** 멘토가 자기 후배를 확인할 때 돌려주는 값. */
export interface MentorMatchView {
  /** 멘토 본인 이름. 코드를 맞게 넣었는지 확인시켜 준다. */
  mentorName: string;
  /** 신청할 때 고른 정원. 몇 자리가 남았는지 함께 보여준다. */
  capacity: number;
  /** 이 선배를 고른 후배. 먼저 고른 순서. 아직 없으면 빈 배열. */
  mentees: { name: string; contact: string; campus?: string; eventArrival?: EventArrival }[];
}

/**
 * 멘토가 참여코드로 자기에게 연결된 후배를 확인한다.
 *
 * 멘토에게는 원래 확인할 방법이 없었다. 멘티가 먼저 문자를 보내면 발신번호로
 * 이름과 번호가 함께 도착하지만, 멘티가 망설이는 동안 멘토는 매칭된 사실조차
 * 알 수 없고 1:1이라 다른 후배와 연결되지도 않는다. 그 공백을 메운다.
 *
 * 연락처를 돌려주는 곳이라 호출부에서 속도 제한을 건다.
 */
export async function findMenteeForMentor(code: string): Promise<MentorMatchView | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: mentor, error } = await supabase
    .from("users")
    .select("id, name, mentor_profiles(*)")
    .eq("participation_code", code)
    .eq("role", "MENTOR")
    .maybeSingle();

  if (error) logDbError("멘토 코드 조회", error);
  if (!mentor) return null;

  const profile = mentor.mentor_profiles as unknown as MentorRow | null;
  const view: MentorMatchView = {
    mentorName: mentor.name as string,
    capacity: profile?.capacity ?? 1,
    mentees: [],
  };

  // 확정된 건만 본다. 추천(SUGGESTED)은 아직 그 멘티가 고른 것이 아니라,
  // 여기서 보여주면 오지도 않을 후배를 기다리게 만든다.
  // 정원이 2명 이상이면 여러 건이라 maybeSingle 을 쓰면 안 된다.
  const { data: matches, error: matchError } = await supabase
    .from("matchings")
    .select("mentee:mentee_id (name, contact, event_arrival, mentee_profiles(target_campus))")
    .eq("mentor_id", mentor.id)
    .in("status", ["REQUESTED", "CONFIRMED"])
    .order("created_at", { ascending: true });

  if (matchError) logDbError("멘토의 확정 매칭 조회", matchError, { participationCode: code });

  for (const raw of (matches ?? []) as unknown[]) {
    const mentee = (raw as {
      mentee: {
        name: string;
        contact: string;
        event_arrival: string | null;
        mentee_profiles: { target_campus?: string[] } | null;
      } | null;
    }).mentee;
    if (!mentee) continue;
    view.mentees.push({
      name: mentee.name,
      contact: mentee.contact,
      campus: mentee.mentee_profiles?.target_campus?.[0],
      eventArrival: asEventArrival(mentee.event_arrival),
    });
  }

  return view;
}

/**
 * 매칭 후보가 되는 멘토.
 *
 * 두 가지를 걸러낸다.
 *  1. 행사 등록만 한 사람 — 관심사·학교가 비어 있어 점수가 나오지 않는다
 *  2. 정원이 다 찬 사람 — 멘토가 고른 수만큼 후배가 이미 골랐다
 *
 * 운영자 화면은 listMentors() 로 전원을 본다. 등록만 한 사람도
 * 행사에는 오기 때문에 명단에서 빠지면 안 된다.
 */
export async function listAvailableMentors(): Promise<Mentor[]> {
  const [mentors, state] = await Promise.all([listMentors(), loadAssignmentState()]);
  return mentors.filter((m) => m.mentoringApplied && hasOpenSeat(m, state));
}

/** 멘토 전체. 운영자 표처럼 배정 여부와 무관하게 다 봐야 할 때 쓴다. */
export async function listMentors(): Promise<Mentor[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_MENTORS;

  const { data, error } = await supabase
    .from("users")
    // !inner 로 두면 멘토링을 신청하지 않은 등록자가 표에서 통째로 사라진다.
    .select("*, mentor_profiles(*)")
    .eq("role", "MENTOR");

  if (error) logDbError("멘토 목록 조회", error);
  if (error || !data) return [];

  return data.map((row) => {
    const { mentor_profiles, ...user } = row as UserRow & { mentor_profiles: MentorRow | null };
    return toMentor(user, mentor_profiles);
  });
}

/** 참여코드로 멘티 한 명을 찾는다. 매칭 결과 화면에서 쓴다. */
/** 멘토링을 신청하지 않았으면 매칭 대상이 아니다. */
export async function findMenteeByCode(code: string): Promise<Mentee | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return MOCK_MENTEES.find((m) => m.participationCode === code) ?? null;
  }

  const { data, error } = await supabase
    .from("users")
    /*
     * !inner 를 쓰면 안 된다. 등록만 한 사람은 프로필이 없어 조인에서 빠지고,
     * 호출부가 "등록 내역을 찾지 못했어요"(404)를 돌려주게 된다.
     * 그러면 등록이 안 된 줄 알고 다시 등록한다 —
     * 멘토링을 신청하지 않았다는 안내(409)를 하려면 사람은 찾아야 한다.
     */
    .select("*, mentee_profiles(*)")
    .eq("participation_code", code)
    .eq("role", "MENTEE")
    .maybeSingle();

  // 코드가 없어서 못 찾은 것(정상)과 조회가 실패한 것은 다르다.
  if (error) logDbError("참여코드로 멘티 조회", error);
  if (error || !data) return null;

  const { mentee_profiles, ...user } = data as UserRow & {
    mentee_profiles: MenteeRow | null;
  };
  return toMentee(user, mentee_profiles);
}

export interface LookupResult {
  code: string;
  name: string;
  role: UserRole;
}

/**
 * 이름과 연락처가 모두 맞아야 참여코드를 돌려준다.
 * 이름만으로 조회되면 아무나 남의 코드를 볼 수 있다.
 */
export async function findCodeByNameAndContact(
  name: string,
  contact: string,
): Promise<LookupResult | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const digits = (v: string) => v.replace(/\D/g, "");
    const all = [
      ...MOCK_MENTEES.map((m) => ({ ...m, role: "MENTEE" as const })),
      ...MOCK_MENTORS.map((m) => ({ ...m, role: "MENTOR" as const })),
    ];
    const hit = all.find(
      (p) => p.name === name.trim() && digits(p.contact) === digits(contact),
    );
    return hit ? { code: hit.participationCode, name: hit.name, role: hit.role } : null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("participation_code, name, role")
    .eq("name", name.trim())
    .eq("contact", contact)
    .maybeSingle();

  // 못 찾은 것(정상)과 조회가 실패한 것은 다르다.
  if (error) logDbError("이름·연락처로 코드 조회", error);
  if (error || !data) return null;
  return {
    code: data.participation_code as string,
    name: data.name as string,
    role: data.role as UserRole,
  };
}

/**
 * 계산된 매칭 결과를 저장한다. 같은 조합은 덮어쓴다.
 *
 * 이번 계산에 없는 예전 추천(SUGGESTED)은 지운다. 남겨 두면 성별이 다르거나
 * 정원이 찬 선배가 운영자 매칭 표에 계속 추천으로 보이고, 후배가 그 선배에게
 * 요청할 길도 열린 채로 남는다. 요청한 짝(REQUESTED/CONFIRMED)은 건드리지 않는다.
 */
export async function saveMatchings(
  menteeId: string,
  rows: { mentorId: string; score: number; breakdown: unknown; rank: number }[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const keep = rows.map((r) => r.mentorId);
  let stale = supabase
    .from("matchings")
    .delete()
    .eq("mentee_id", menteeId)
    .eq("status", "SUGGESTED");
  if (keep.length > 0) stale = stale.not("mentor_id", "in", `(${keep.join(",")})`);
  const { error: staleError } = await stale;
  if (staleError) logDbError("지난 추천 정리", staleError);

  if (rows.length === 0) return;

  await supabase.from("matchings").upsert(
    rows.map((r) => ({
      mentee_id: menteeId,
      mentor_id: r.mentorId,
      score: r.score,
      breakdown: r.breakdown,
      rank: r.rank,
    })),
    { onConflict: "mentee_id,mentor_id" },
  );
}

/** 운영자 실행에서도 멘티 화면과 같은 수만 추천한다. */
const MATCH_TOP_N = 3;

export interface MatchRunResult {
  /** 대상이 된 멘티 수 (멘토링을 신청한 사람만) */
  applicants: number;
  /** 이번에 추천을 새로 계산한 멘티 수 */
  computed: number;
  /** 이미 짝이 정해져 건드리지 않은 멘티 수 */
  settled: number;
  /** 지망 캠퍼스에 선배가 없어 대체 후보(같은 학과·지역)만 추천한 멘티 수 */
  fallbackOnly: number;
  /** 대체 후보까지 없어 추천이 비어 있는 멘티 수 */
  noCandidates: number;
}

/**
 * 멘토링을 신청한 멘티 전원의 추천을 다시 계산한다.
 *
 * 왜 필요한가: 추천은 멘티가 결과 화면을 열어야 계산·저장된다. 신청만 하고
 * 화면을 안 본 사람은 운영자 매칭 표에 한 줄도 없어서, 당일 짝 명단을
 * 온전히 뽑을 수 없다. 이 함수가 그 빈칸을 채운다.
 *
 * 짝을 정하지는 않는다. 어디까지나 '추천'(SUGGESTED)만 만들고, 실제로 누구와
 * 만날지는 멘티가 직접 고른다. 운영자가 임의로 맺어 준 짝은 당사자가
 * 납득하기 어렵고, 1:1이라 한 번 정하면 되돌릴 수도 없다.
 *
 * 이미 '매칭하기'를 눌러 확정된 멘티는 통째로 건너뛴다. 다시 계산하면
 * 그 사람이 고른 멘토가 후보에서 빠져 있어 배정이 흔들린다.
 */
export async function runMatchingForAll(): Promise<MatchRunResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { applicants: 0, computed: 0, settled: 0, fallbackOnly: 0, noCandidates: 0 };
  }

  const [mentees, mentors] = await Promise.all([listMentees(), listMentors()]);

  // 멘토링을 신청한 사람만 대상이다. 등록만 한 분은 애초에 매칭 대상이 아니다.
  const applicants = mentees.filter((m) => m.mentoringApplied);
  const result: MatchRunResult = {
    applicants: applicants.length,
    computed: 0,
    settled: 0,
    fallbackOnly: 0,
    noCandidates: 0,
  };

  for (const mentee of applicants) {
    const settledMatch = await findSettledMatch(mentee.id);
    if (settledMatch) {
      result.settled++;
      continue;
    }

    // 후보는 매번 다시 추린다. 앞선 멘티가 확정해 정원이 차면 그 멘토는 빠져야 한다.
    const state = await loadAssignmentState();
    const available = mentors.filter((m) => m.mentoringApplied && hasOpenSeat(m, state));

    const recommended = recommendMentors(mentee, available, MATCH_TOP_N);
    const rows = recommended.map((r, i) => ({
      mentorId: r.mentor.id,
      score: r.score,
      breakdown: r.breakdown as unknown,
      rank: i + 1,
    }));

    // 후보가 없어도 부른다. 예전 추천이 남아 있으면 지워야 한다.
    await saveMatchings(mentee.id, rows);
    if (rows.length === 0) {
      result.noCandidates++;
      continue;
    }

    result.computed++;
    if (recommended[0].fallback) result.fallbackOnly++;
  }

  return result;
}

/** 운영자 표에 쓰는 멘티 전체. */
export async function listMentees(): Promise<Mentee[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_MENTEES;

  const { data, error } = await supabase
    .from("users")
    // 등록만 한 멘티도 운영자 표에는 보여야 한다.
    .select("*, mentee_profiles(*)")
    .eq("role", "MENTEE")
    .order("created_at", { ascending: false });

  if (error) logDbError("멘티 목록 조회", error);
  if (error || !data) return [];

  return data.map((row) => {
    const { mentee_profiles, ...user } = row as UserRow & { mentee_profiles: MenteeRow | null };
    return toMentee(user, mentee_profiles);
  });
}

/** 운영자 표에 쓰는 매칭 결과 한 행. */
export interface MatchingRow {
  menteeCode: string;
  menteeName: string;
  menteeCampus: string;
  mentorCode: string;
  mentorName: string;
  mentorCampus: string;
  mentorContact: string;
  score: number;
  rank: number;
  status: string;
  breakdown: ScoreBreakdown;
  /** 지망 캠퍼스 밖의 대체 후보면 그 이유. */
  fallback?: FallbackReason;
}

/**
 * 저장된 매칭 결과를 멘티·멘토 이름과 함께 가져온다.
 * 매칭은 멘티가 결과 화면을 열 때 계산되어 쌓이므로,
 * 아직 결과를 안 본 멘티는 여기 나오지 않는다.
 */
export async function listMatchings(): Promise<MatchingRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("matchings")
    .select(
      `score, rank, status, breakdown,
       mentee:mentee_id (participation_code, name, mentee_profiles(target_campus, target_majors)),
       mentor:mentor_id (participation_code, name, contact, mentor_profiles(current_campus, current_majors))`,
    )
    .order("rank", { ascending: true });

  if (error) logDbError("매칭 목록 조회", error);
  if (error || !data) return [];

  return (data as unknown[]).map((raw) => {
    const row = raw as {
      score: number;
      rank: number;
      status: string;
      breakdown: MatchingRow["breakdown"];
      mentee: {
        participation_code: string;
        name: string;
        mentee_profiles: { target_campus: string[]; target_majors: string[] } | null;
      };
      mentor: {
        participation_code: string;
        name: string;
        contact: string;
        mentor_profiles: { current_campus: string; current_majors: string[] } | null;
      };
    };

    // 대체 후보 여부는 저장하지 않고 두 사람의 정보로 다시 판단한다.
    // 멘티 화면이 쓰는 것과 같은 함수라 두 화면의 구분이 어긋나지 않는다.
    const menteeProfile = row.mentee.mentee_profiles;
    const mentorProfile = row.mentor.mentor_profiles;
    const fallback =
      menteeProfile && mentorProfile
        ? fallbackReason(
            {
              targetCampus: menteeProfile.target_campus as Campus[],
              targetMajors: menteeProfile.target_majors,
            },
            {
              currentCampus: mentorProfile.current_campus as Campus,
              currentMajors: mentorProfile.current_majors,
            },
          )
        : undefined;

    return {
      menteeCode: row.mentee.participation_code,
      menteeName: row.mentee.name,
      menteeCampus: row.mentee.mentee_profiles?.target_campus?.[0] ?? "-",
      mentorCode: row.mentor.participation_code,
      mentorName: row.mentor.name,
      mentorCampus: row.mentor.mentor_profiles?.current_campus ?? "-",
      mentorContact: row.mentor.contact,
      score: row.score,
      rank: row.rank,
      status: row.status,
      breakdown: row.breakdown,
      fallback,
    };
  });
}

/**
 * 멘티가 특정 멘토에게 매칭을 요청한다.
 * 요청이 기록된 뒤에야 멘토의 전체 연락처를 돌려준다.
 */
export async function requestMatch(
  participationCode: string,
  mentorId: string,
): Promise<{
  ok: boolean;
  contact?: string;
  mentorName?: string;
  /** 선배의 채플 당일 도착 시간. 연결된 후배에게만 알려준다. */
  mentorEventArrival?: EventArrival;
  error?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "서버가 연결되지 않았어요." };

  // 코드의 주인만 요청할 수 있다. mentee_id 를 요청 본문에서 받으면
  // 남의 매칭에 임의로 요청을 넣을 수 있다.
  const { data: mentee } = await supabase
    .from("users")
    .select("id, gender")
    .eq("participation_code", participationCode)
    .eq("role", "MENTEE")
    .maybeSingle();

  if (!mentee) return { ok: false, error: "신청 내역을 찾지 못했어요." };

  // 이미 계산되어 저장된 매칭에만 요청할 수 있다.
  // 그래야 아무 멘토 id나 넣어 연락처를 캐낼 수 없다.
  const { data: matching } = await supabase
    .from("matchings")
    .select("id, status")
    .eq("mentee_id", mentee.id)
    .eq("mentor_id", mentorId)
    .maybeSingle();

  if (!matching) return { ok: false, error: "매칭된 멘토가 아니에요." };

  // 이미 이 조합으로 요청했으면 연락처만 다시 보여준다.
  const alreadyMine = matching.status === "REQUESTED" || matching.status === "CONFIRMED";

  if (!alreadyMine) {
    /*
     * 같은 성별끼리만 이어 준다. 추천은 이미 그렇게 계산하지만, 성별 조건을
     * 넣기 전에 저장된 추천(SUGGESTED)이 남아 있을 수 있어 여기서 한 번 더 막는다.
     * 이미 이어진 짝(위 alreadyMine)은 번호를 다시 보여줘야 해서 건드리지 않는다.
     */
    const { data: mentorGender } = await supabase
      .from("users")
      .select("gender")
      .eq("id", mentorId)
      .maybeSingle();
    if (!mentee.gender || mentee.gender !== mentorGender?.gender) {
      return { ok: false, error: "매칭된 멘토가 아니에요." };
    }

    // 멘티는 선배를 한 명만 고를 수 있다. 여러 명을 맡는 것은 선배 쪽뿐이다.
    const { data: myOther } = await supabase
      .from("matchings")
      .select("id")
      .eq("mentee_id", mentee.id)
      .in("status", ["REQUESTED", "CONFIRMED"])
      .maybeSingle();

    if (myOther) {
      return { ok: false, error: "이미 다른 선배와 매칭하셨어요. 한 분과만 연결돼요." };
    }

    const { error: updateError } = await supabase
      .from("matchings")
      .update({ status: "REQUESTED" })
      .eq("id", matching.id);

    // DB 트리거(정원)와 부분 유니크 인덱스(멘티 1명)가 마지막 방어선이다.
    // 마지막 한 자리에 두 멘티가 같은 순간에 눌러도 하나만 통과한다.
    if (updateError) {
      logDbError("매칭 요청", updateError, { participationCode });
      return {
        ok: false,
        error: "방금 이 선배의 자리가 다 찼어요. 다른 선배를 선택해주세요.",
      };
    }
  }

  const { data: mentor, error: mentorError } = await supabase
    .from("users")
    .select("name, contact, event_arrival")
    .eq("id", mentorId)
    .maybeSingle();

  // 매칭은 이미 성사됐는데 여기서 막히면 후배는 번호를 못 받는다. 원인을 남긴다.
  if (mentorError) logDbError("매칭된 멘토 조회", mentorError, { participationCode });
  if (!mentor) return { ok: false, error: "멘토 정보를 찾지 못했어요." };

  return {
    ok: true,
    contact: mentor.contact as string,
    mentorName: mentor.name as string,
    mentorEventArrival: asEventArrival(mentor.event_arrival as string | null),
  };
}

export interface UnmatchedReason {
  code: string;
  name: string;
  targetCampus: string[];
  /** 지망 캠퍼스에 있는, 아직 자리가 남은 멘토 수 */
  mentorsInCampus: number;
  /** 왜 매칭이 안 됐는지 */
  reason: "캠퍼스에 멘토 없음" | "대체 후보만 추천" | "결과 미확인";
}

/**
 * 매칭되지 않은 멘티와 그 원인.
 *
 * 운영자가 "어느 캠퍼스 멘토를 더 모집해야 하는지" 판단하려면
 * 인원수만으로는 부족하고 원인이 필요하다.
 *
 * 대체 후보(같은 학과·지역 선배)만 추천받은 멘티도 여기 남긴다. 후보가
 * 있긴 하지만 지망 캠퍼스 선배를 모집하면 그쪽으로 옮겨 갈 사람들이다.
 */
export async function listUnmatched(): Promise<UnmatchedReason[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [mentees, mentors, state, matchings] = await Promise.all([
    listMentees(),
    listMentors(),
    loadAssignmentState(),
    supabase.from("matchings").select("mentee_id, mentor_id"),
  ]);

  if (matchings.error) logDbError("미매칭 계산 - 매칭 조회", matchings.error);

  // 정원이 다 찬 멘토는 이 멘티가 만날 수 없다.
  // 전체 수를 세면 "캠퍼스에 3명 있는데 왜 매칭이 안 되지"로 오해한다.
  const available = mentors.filter((m) => m.mentoringApplied && hasOpenSeat(m, state));
  const campusOf = new Map(mentors.map((m) => [m.id, m.currentCampus as string]));

  const suggestedCampuses = new Map<string, string[]>();
  for (const row of matchings.data ?? []) {
    const menteeId = row.mentee_id as string;
    const campus = campusOf.get(row.mentor_id as string);
    if (!campus) continue;
    suggestedCampuses.set(menteeId, [...(suggestedCampuses.get(menteeId) ?? []), campus]);
  }

  return mentees
    // 멘토링을 신청하지 않은 사람은 '미매칭'이 아니다. 애초에 대상이 아니다.
    // 대체 후보 중에서라도 이미 선배를 고른 사람은 매칭된 것이다.
    .filter((mentee) => mentee.mentoringApplied && !state.settledMentees.has(mentee.id))
    .flatMap((mentee): UnmatchedReason[] => {
      const suggested = suggestedCampuses.get(mentee.id) ?? [];
      // 지망 캠퍼스 선배를 추천받았으면 매칭된 것으로 본다. 고르는 일만 남았다.
      if (suggested.some((campus) => (mentee.targetCampus as string[]).includes(campus))) {
        return [];
      }

      // 성별이 다른 선배는 이 후배와 이어질 수 없어 세지 않는다.
      const inCampus = available.filter(
        (m) => mentee.targetCampus.includes(m.currentCampus) && isSameGender(mentee, m),
      );
      return [
        {
          code: mentee.participationCode,
          name: mentee.name,
          targetCampus: mentee.targetCampus,
          mentorsInCampus: inCampus.length,
          reason:
            inCampus.length > 0
              ? "결과 미확인"
              : suggested.length > 0
                ? "대체 후보만 추천"
                : "캠퍼스에 멘토 없음",
        },
      ];
    });
}

/** 선배에게 알렸는지. 운영자 화면과 notify-mentors 스크립트가 같은 값을 쓴다. */
export type MentorNoticeVia = "ADMIN_SMS" | "MAC_MESSAGES";

/** 성사된 매칭 한 건과 선배 알림 상태. */
export interface MentorNoticeRow {
  matchingId: string;
  menteeName: string;
  menteeArrival?: EventArrival;
  mentorName: string;
  mentorCode: string;
  mentorContact: string;
  /** 아직 알리지 않았으면 undefined */
  notifiedAt?: string;
  notifiedVia?: MentorNoticeVia;
}

/**
 * 성사된 매칭 전부와 선배 알림 상태.
 *
 * 추천(SUGGESTED)은 넣지 않는다. 후배가 아직 고르지 않았으니 알릴 일이 없다.
 * 알릴 것이 위로 오도록 아직 안 보낸 건을 먼저, 그 안에서는 오래된 순으로 둔다.
 */
export async function listMentorNotices(): Promise<MentorNoticeRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("matchings")
    .select(
      `id, created_at, mentor_notified_at, mentor_notified_via,
       mentee:mentee_id (name, event_arrival),
       mentor:mentor_id (participation_code, name, contact)`,
    )
    .in("status", ["REQUESTED", "CONFIRMED"])
    .order("created_at", { ascending: true });

  if (error) logDbError("선배 알림 목록 조회", error);
  if (error || !data) return [];

  const rows = (data as unknown[]).flatMap((raw): MentorNoticeRow[] => {
    const row = raw as {
      id: string;
      mentor_notified_at: string | null;
      mentor_notified_via: MentorNoticeVia | null;
      mentee: { name: string; event_arrival: string | null } | null;
      mentor: { participation_code: string; name: string; contact: string } | null;
    };
    // 사람이 지워졌으면 알릴 대상도 없다.
    if (!row.mentee || !row.mentor) return [];
    return [
      {
        matchingId: row.id,
        menteeName: row.mentee.name,
        menteeArrival: asEventArrival(row.mentee.event_arrival),
        mentorName: row.mentor.name,
        mentorCode: row.mentor.participation_code,
        mentorContact: row.mentor.contact,
        notifiedAt: row.mentor_notified_at ?? undefined,
        notifiedVia: row.mentor_notified_via ?? undefined,
      },
    ];
  });

  return [...rows.filter((r) => !r.notifiedAt), ...rows.filter((r) => r.notifiedAt)];
}

/**
 * 선배에게 알렸다고 기록한다(또는 기록을 지운다).
 *
 * 이미 기록된 건은 덮어쓰지 않는다. 휴대폰 두 대로 같은 화면을 열어 둔 운영자가
 * 동시에 눌러도 처음 보낸 시각과 방법이 남는다. 잘못 누른 경우만 되돌린다.
 */
export async function setMentorNotified(
  matchingId: string,
  via: MentorNoticeVia | null,
): Promise<{ ok: boolean; notifiedAt?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };

  const query =
    via === null
      ? supabase
          .from("matchings")
          .update({ mentor_notified_at: null, mentor_notified_via: null })
          .eq("id", matchingId)
      : supabase
          .from("matchings")
          .update({ mentor_notified_at: new Date().toISOString(), mentor_notified_via: via })
          .eq("id", matchingId)
          .is("mentor_notified_at", null);

  const { error } = await query;
  if (error) {
    logDbError("선배 알림 기록", error);
    return { ok: false };
  }

  const { data } = await supabase
    .from("matchings")
    .select("mentor_notified_at")
    .eq("id", matchingId)
    .maybeSingle();
  return { ok: true, notifiedAt: (data?.mentor_notified_at as string | null) ?? undefined };
}
