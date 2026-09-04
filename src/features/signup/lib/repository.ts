import "server-only";

import type { Mentee, Mentor, ScoreBreakdown } from "@/features/matching/model/types";
import type { OnboardingDraft } from "@/features/onboarding/model/types";
import type { Role } from "@/shared/constants/role";
import type { Campus, Career, Gender, Major, MentoringArea, TimeSlot } from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import { getSupabase } from "@/shared/lib/supabase/server";
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

function toMentee(user: UserRow, profile: MenteeRow): Mentee {
  return {
    id: user.id,
    participationCode: user.participation_code,
    name: user.name,
    gender: user.gender,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    availableTimes: user.available_times as TimeSlot[],
    targetCampus: profile.target_campus as Campus[],
    desiredAreas: profile.desired_areas as MentoringArea[],
    personaType: user.persona_type,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    targetMajors: profile.target_majors as Major[],
    targetCareers: profile.target_careers as Career[],
  };
}

function toMentor(user: UserRow, profile: MentorRow): Mentor {
  return {
    id: user.id,
    participationCode: user.participation_code,
    name: user.name,
    gender: user.gender,
    contact: user.contact,
    highSchool: user.high_school ?? undefined,
    referrer: user.referrer ?? undefined,
    photoUrl: user.photo_url ?? undefined,
    availableTimes: user.available_times as TimeSlot[],
    currentCampus: profile.current_campus as Campus,
    admissionYear: profile.admission_year,
    mentoringArea: profile.mentoring_area as MentoringArea[],
    personaType: user.persona_type,
    mbti: (user.mbti ?? undefined) as MbtiType | undefined,
    currentMajors: profile.current_majors as Major[],
    careerPaths: profile.career_paths as Career[],
  };
}

export interface SaveResult {
  ok: boolean;
  userId?: string;
  /** 실패 사유. 화면에 그대로 보여줄 수 있는 한국어 문장. */
  error?: string;
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

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      role,
      participation_code: participationCode,
      name: draft.name,
      gender: draft.gender,
      contact: draft.contact,
      persona_type: draft.personaType,
      mbti: draft.mbti ?? null,
      high_school: draft.highSchool ?? null,
      referrer: draft.referrer ?? null,
      photo_url: draft.photoUrl ?? null,
      available_times: draft.availableTimes,
      consented_at: draft.consentedAt,
      consent_version: draft.consentVersion,
    })
    .select("id")
    .single();

  if (userError || !user) {
    // 참여코드가 겹치는 건 사실상 없지만(31^6 조합), 겹치면 재발급이 필요하다.
    if (userError?.code === "23505") {
      return { ok: false, error: "코드가 중복되었어요. 다시 시도해주세요.", };
    }
    return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const profileError =
    role === "MENTEE"
      ? (
          await supabase.from("mentee_profiles").insert({
            user_id: user.id,
            target_campus: draft.targetCampus,
            desired_areas: draft.desiredAreas,
            target_majors: draft.targetMajors,
            target_careers: draft.targetCareers,
          })
        ).error
      : (
          await supabase.from("mentor_profiles").insert({
            user_id: user.id,
            current_campus: draft.currentCampus,
            admission_year: draft.admissionYear,
            mentoring_area: draft.mentoringArea,
            current_majors: draft.currentMajors,
            career_paths: draft.careerPaths,
          })
        ).error;

  if (profileError) {
    // 프로필이 없는 users 행이 남으면 매칭에서 터진다. 되돌린다.
    await supabase.from("users").delete().eq("id", user.id);
    return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  return { ok: true, userId: user.id };
}

/** 매칭 대상이 되는 멘토 전체. 자격증명이 없으면 더미로 대체한다. */
export async function listMentors(): Promise<Mentor[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_MENTORS;

  const { data, error } = await supabase
    .from("users")
    .select("*, mentor_profiles!inner(*)")
    .eq("role", "MENTOR");

  if (error || !data) return [];

  return data.map((row) => {
    const { mentor_profiles, ...user } = row as UserRow & { mentor_profiles: MentorRow };
    return toMentor(user, mentor_profiles);
  });
}

/** 참여코드로 멘티 한 명을 찾는다. 매칭 결과 화면에서 쓴다. */
export async function findMenteeByCode(code: string): Promise<Mentee | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return MOCK_MENTEES.find((m) => m.participationCode === code) ?? null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*, mentee_profiles!inner(*)")
    .eq("participation_code", code)
    .eq("role", "MENTEE")
    .maybeSingle();

  if (error || !data) return null;

  const { mentee_profiles, ...user } = data as UserRow & { mentee_profiles: MenteeRow };
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

/** 운영자 표에 쓰는 멘티 전체. */
export async function listMentees(): Promise<Mentee[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_MENTEES;

  const { data, error } = await supabase
    .from("users")
    .select("*, mentee_profiles!inner(*)")
    .eq("role", "MENTEE")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const { mentee_profiles, ...user } = row as UserRow & { mentee_profiles: MenteeRow };
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
    .select("id")
    .eq("mentee_id", mentee.id)
    .eq("mentor_id", mentorId)
    .maybeSingle();

  if (!matching) return { ok: false, error: "매칭된 멘토가 아니에요." };

  await supabase.from("matchings").update({ status: "REQUESTED" }).eq("id", matching.id);

  const { data: mentor } = await supabase
    .from("users")
    .select("name, contact")
    .eq("id", mentorId)
    .maybeSingle();

  if (!mentor) return { ok: false, error: "멘토 정보를 찾지 못했어요." };

  return { ok: true, contact: mentor.contact as string, mentorName: mentor.name as string };
}
