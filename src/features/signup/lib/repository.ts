import "server-only";

import type { Mentee, Mentor } from "@/features/matching/model/types";
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
