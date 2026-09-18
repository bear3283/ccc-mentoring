import "server-only";

import type { Mentee, Mentor, ScoreBreakdown } from "@/features/matching/model/types";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import type { Role } from "@/shared/constants/role";
import type { Campus, Career, Gender, Major, MentoringArea, TimeSlot } from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import { safeForLog } from "@/shared/lib/security/mask";
import { getSupabase } from "@/shared/lib/supabase/server";
import { matchMentors } from "@/features/matching/lib/score";
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
  gender: Gender;
  contact: string;
  persona_type: PersonaType;
  mbti: string | null;
  high_school: string | null;
  referrer: string | null;
  photo_url: string | null;
  available_times: string[];
  church: string | null;
  is_new_friend: boolean;
  mentoring_applied: boolean;
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
    gender: user.gender,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    church: user.church ?? undefined,
    isNewFriend: user.is_new_friend ?? false,
    mentoringApplied: user.mentoring_applied ?? false,
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    availableTimes: user.available_times as TimeSlot[],
    targetCampus: (profile?.target_campus ?? []) as Campus[],
    desiredAreas: (profile?.desired_areas ?? []) as MentoringArea[],
    personaType: user.persona_type,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    targetMajors: (profile?.target_majors ?? []) as Major[],
    targetCareers: (profile?.target_careers ?? []) as Career[],
  };
}

/** toMentee 와 같은 이유로 프로필이 없을 수 있다. */
function toMentor(user: UserRow, profile: MentorRow | null): Mentor {
  return {
    id: user.id,
    participationCode: user.participation_code,
    name: user.name,
    gender: user.gender,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    church: user.church ?? undefined,
    isNewFriend: user.is_new_friend ?? false,
    mentoringApplied: user.mentoring_applied ?? false,
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    availableTimes: user.available_times as TimeSlot[],
    currentCampus: profile?.current_campus as Campus,
    admissionYear: profile?.admission_year ?? 0,
    mentoringArea: (profile?.mentoring_area ?? []) as MentoringArea[],
    personaType: user.persona_type,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    currentMajors: (profile?.current_majors ?? []) as Major[],
    careerPaths: (profile?.career_paths ?? []) as Career[],
  };
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
 * 같은 연락처로 이미 신청했는지 본다.
 *
 * 이름까지 같으면 본인이 다시 제출한 것으로 보고 기존 코드를 돌려준다.
 * 이름이 다르면 남의 번호를 잘못 적었거나 번호를 공유하는 경우라
 * 코드를 알려주지 않고 막는다.
 */
export async function findExistingSignup(
  role: UserRole,
  name: string,
  contact: string,
): Promise<{ sameName: boolean; code: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("users")
    .select("participation_code, name")
    .eq("contact", contact)
    .eq("role", role)
    .maybeSingle();

  // 조회가 실패하면 "처음 신청하는 사람"으로 읽혀 중복 확인이 통째로 건너뛰어진다.
  if (error) logDbError("중복 신청 확인", error);
  if (!data) return null;
  return {
    sameName: (data.name as string).trim() === name.trim(),
    code: data.participation_code as string,
  };
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
    return existing.sameName
      ? { ok: false, existingCode: existing.code }
      : {
          ok: false,
          error: "이미 등록된 연락처예요. 번호를 다시 확인해주세요.",
        };
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      role,
      participation_code: participationCode,
      name: draft.name,
      gender: draft.gender ?? null,
      contact: draft.contact,
      church: draft.church ?? null,
      is_new_friend: draft.isNewFriend ?? false,
      // 멘토링을 신청하지 않은 등록자는 아래 값들이 비어 있다.
      mentoring_applied: draft.mentoringApplied ?? false,
      persona_type: draft.personaType ?? null,
      mbti: draft.mbti ?? null,
      high_school: draft.highSchool ?? null,
      referrer: draft.referrer ?? null,
      photo_url: draft.photoUrl ?? null,
      available_times: draft.availableTimes ?? [],
      consented_at: draft.consentedAt,
      consent_version: draft.consentVersion,
    })
    .select("id")
    .single();

  if (userError || !user) {
    // 참여코드가 겹치는 건 사실상 없지만(31^6 조합), 겹치면 재발급이 필요하다.
    // 이건 정상 경로라 로그를 남기지 않는다 — 호출부가 코드를 다시 뽑아 재시도한다.
    if (userError?.code === "23505") {
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
 * 이미 배정이 끝난 멘토의 id.
 *
 * 매칭은 1:1이라, 멘티가 '매칭하기'를 눌러 성사된 멘토는 다른 멘티의
 * 후보에서 빠져야 한다. 추천(SUGGESTED)만 된 상태는 아직 성사가 아니므로
 * 후보로 남는다. 그렇지 않으면 첫 멘티가 결과를 여는 순간 멘토 3명이 잠긴다.
 */
export async function listTakenMentorIds(): Promise<Set<string>> {
  const supabase = getSupabase();
  if (!supabase) return new Set();

  const { data } = await supabase
    .from("matchings")
    .select("mentor_id")
    .in("status", ["REQUESTED", "CONFIRMED"]);

  return new Set((data ?? []).map((row) => row.mentor_id as string));
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
      persona_type: draft.personaType,
      mbti: draft.mbti ?? null,
      photo_url: draft.photoUrl ?? null,
      available_times: draft.availableTimes,
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
              target_careers: draft.targetCareers,
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
              career_paths: draft.careerPaths,
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
  /** 아직 아무도 고르지 않았으면 undefined. */
  mentee?: { name: string; contact: string; campus?: string };
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
    .select("id, name")
    .eq("participation_code", code)
    .eq("role", "MENTOR")
    .maybeSingle();

  if (error) logDbError("멘토 코드 조회", error);
  if (!mentor) return null;

  // 확정된 건만 본다. 추천(SUGGESTED)은 아직 그 멘티가 고른 것이 아니라,
  // 여기서 보여주면 오지도 않을 후배를 기다리게 만든다.
  const { data: match, error: matchError } = await supabase
    .from("matchings")
    .select("mentee_id")
    .eq("mentor_id", mentor.id)
    .in("status", ["REQUESTED", "CONFIRMED"])
    .maybeSingle();

  if (matchError) logDbError("멘토의 확정 매칭 조회", matchError, { participationCode: code });
  if (!match) return { mentorName: mentor.name as string };

  const { data: mentee, error: menteeError } = await supabase
    .from("users")
    .select("name, contact, mentee_profiles(target_campus)")
    .eq("id", match.mentee_id)
    .maybeSingle();

  if (menteeError) logDbError("연결된 멘티 조회", menteeError, { participationCode: code });
  if (!mentee) return { mentorName: mentor.name as string };

  const profile = mentee.mentee_profiles as { target_campus?: string[] } | null;
  return {
    mentorName: mentor.name as string,
    mentee: {
      name: mentee.name as string,
      contact: mentee.contact as string,
      campus: profile?.target_campus?.[0],
    },
  };
}

/**
 * 매칭 후보가 되는 멘토.
 *
 * 두 가지를 걸러낸다.
 *  1. 행사 등록만 한 사람 — 관심사·시간대가 비어 있어 점수가 나오지 않는다
 *  2. 이미 배정된 사람 — 매칭은 1:1이다
 *
 * 운영자 화면은 listMentors() 로 전원을 본다. 등록만 한 사람도
 * 행사에는 오기 때문에 명단에서 빠지면 안 된다.
 */
export async function listAvailableMentors(): Promise<Mentor[]> {
  const [mentors, taken] = await Promise.all([listMentors(), listTakenMentorIds()]);
  return mentors.filter((m) => m.mentoringApplied && !taken.has(m.id));
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

/** 계산된 매칭 결과를 저장한다. 같은 조합은 덮어쓴다. */
export async function saveMatchings(
  menteeId: string,
  rows: { mentorId: string; score: number; breakdown: unknown; rank: number }[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return;

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
  /** 조건에 맞는 선배가 없어 추천이 비어 있는 멘티 수 */
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
  if (!supabase) return { applicants: 0, computed: 0, settled: 0, noCandidates: 0 };

  const [mentees, mentors] = await Promise.all([listMentees(), listMentors()]);

  // 멘토링을 신청한 사람만 대상이다. 등록만 한 분은 애초에 매칭 대상이 아니다.
  const applicants = mentees.filter((m) => m.mentoringApplied);
  const result: MatchRunResult = {
    applicants: applicants.length,
    computed: 0,
    settled: 0,
    noCandidates: 0,
  };

  for (const mentee of applicants) {
    const settledMatch = await findSettledMatch(mentee.id);
    if (settledMatch) {
      result.settled++;
      continue;
    }

    // 후보는 매번 다시 추린다. 앞선 멘티가 확정하면 그 멘토는 빠져야 한다.
    const currentlyTaken = await listTakenMentorIds();
    const available = mentors.filter(
      (m) => m.mentoringApplied && !currentlyTaken.has(m.id),
    );

    const rows = matchMentors(mentee, available, MATCH_TOP_N).map((r, i) => ({
      mentorId: r.mentor.id,
      score: r.score,
      breakdown: r.breakdown as unknown,
      rank: i + 1,
    }));

    if (rows.length === 0) {
      result.noCandidates++;
      continue;
    }

    await saveMatchings(mentee.id, rows);
    result.computed++;
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
       mentee:mentee_id (participation_code, name, mentee_profiles(target_campus)),
       mentor:mentor_id (participation_code, name, contact, mentor_profiles(current_campus))`,
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
        mentee_profiles: { target_campus: string[] } | null;
      };
      mentor: {
        participation_code: string;
        name: string;
        contact: string;
        mentor_profiles: { current_campus: string } | null;
      };
    };

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
): Promise<{ ok: boolean; contact?: string; mentorName?: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "서버가 연결되지 않았어요." };

  // 코드의 주인만 요청할 수 있다. mentee_id 를 요청 본문에서 받으면
  // 남의 매칭에 임의로 요청을 넣을 수 있다.
  const { data: mentee } = await supabase
    .from("users")
    .select("id")
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
    // 1:1이라 멘티도 한 명만 고를 수 있다.
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

    // DB의 부분 유니크 인덱스가 마지막 방어선이다.
    // 두 멘티가 같은 순간에 눌러도 하나만 통과한다.
    if (updateError) {
      return {
        ok: false,
        error: "방금 다른 후배와 매칭됐어요. 다른 선배를 선택해주세요.",
      };
    }
  }

  const { data: mentor } = await supabase
    .from("users")
    .select("name, contact")
    .eq("id", mentorId)
    .maybeSingle();

  if (!mentor) return { ok: false, error: "멘토 정보를 찾지 못했어요." };

  return { ok: true, contact: mentor.contact as string, mentorName: mentor.name as string };
}

export interface UnmatchedReason {
  code: string;
  name: string;
  targetCampus: string[];
  /** 지망 캠퍼스에 있는 멘토 수 */
  mentorsInCampus: number;
  /** 왜 매칭이 안 됐는지 */
  reason: "캠퍼스에 멘토 없음" | "결과 미확인" | "조건 불일치";
}

/**
 * 매칭되지 않은 멘티와 그 원인.
 *
 * 운영자가 "어느 캠퍼스 멘토를 더 모집해야 하는지" 판단하려면
 * 인원수만으로는 부족하고 원인이 필요하다.
 */
export async function listUnmatched(): Promise<UnmatchedReason[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [mentees, mentors, matchings] = await Promise.all([
    listMentees(),
    // 1:1이라 이미 배정된 멘토는 이 멘티가 만날 수 없다.
    // 전체 수를 세면 "캠퍼스에 3명 있는데 왜 매칭이 안 되지"로 오해한다.
    listAvailableMentors(),
    supabase.from("matchings").select("mentee_id"),
  ]);

  const matchedIds = new Set((matchings.data ?? []).map((m) => m.mentee_id as string));

  return mentees
    // 멘토링을 신청하지 않은 사람은 '미매칭'이 아니다. 애초에 대상이 아니다.
    .filter((mentee) => mentee.mentoringApplied && !matchedIds.has(mentee.id))
    .map((mentee) => {
      const inCampus = mentors.filter((m) => mentee.targetCampus.includes(m.currentCampus));
      return {
        code: mentee.participationCode,
        name: mentee.name,
        targetCampus: mentee.targetCampus,
        mentorsInCampus: inCampus.length,
        reason:
          inCampus.length === 0
            ? ("캠퍼스에 멘토 없음" as const)
            : ("결과 미확인" as const),
      };
    });
}
