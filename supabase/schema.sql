-- CCC 멘토-멘티 매칭 스키마
--
-- Supabase 대시보드의 SQL Editor에 그대로 붙여넣어 실행하세요.
-- 여러 번 실행해도 안전하도록 작성했습니다.

-- ─────────────────────────────────────────────────────────────
-- 열거형
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('MENTEE', 'MENTOR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_type as enum ('MALE', 'FEMALE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type persona_type as enum ('DAVID', 'SOLOMON', 'ESTHER', 'NOAH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type matching_status as enum ('SUGGESTED', 'REQUESTED', 'CONFIRMED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- users : 멘티와 멘토의 공통 정보
-- ─────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,

  -- 신청자가 문의할 때 대는 번호. 사람이 읽고 입력하는 값이라 대문자 6자로 고정한다.
  participation_code text not null unique
    check (participation_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),

  name text not null check (char_length(trim(name)) >= 2),
  gender gender_type not null,
  contact text not null check (contact ~ '^01[016-9]-\d{3,4}-\d{4}$'),

  -- 아이스브레이킹. 매칭 점수에는 쓰지 않는다.
  persona_type persona_type not null,
  mbti text check (mbti is null or mbti ~ '^[EI][SN][TF][JP]$'),

  -- 참고용. 사실 확인이 불가능해 매칭에 반영하지 않는다.
  high_school text,
  referrer text,

  photo_url text,

  -- 시간대 코드 배열. 예: {WEEKDAY_EVENING, WEEKEND_NIGHT}
  available_times text[] not null default '{}'
    check (array_length(available_times, 1) >= 1),

  created_at timestamptz not null default now()
);

-- 조회는 이름+연락처가 모두 맞아야 하므로 두 열을 함께 인덱싱한다.
create index if not exists users_name_contact_idx on public.users (name, contact);
create index if not exists users_role_idx on public.users (role);

-- ─────────────────────────────────────────────────────────────
-- mentee_profiles : 고3 수험생
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mentee_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,

  -- 인덱스 0이 1지망. 순서가 곧 지망 순위라 배열을 그대로 쓴다.
  target_campus text[] not null
    check (array_length(target_campus, 1) between 1 and 3),

  desired_areas text[] not null
    check (array_length(desired_areas, 1) between 1 and 3),
  target_majors text[] not null
    check (array_length(target_majors, 1) between 1 and 3),
  target_careers text[] not null
    check (array_length(target_careers, 1) between 1 and 3)
);

-- ─────────────────────────────────────────────────────────────
-- mentor_profiles : CCC 재학생
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mentor_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,

  current_campus text not null,
  admission_year int not null check (admission_year between 2010 and 2040),

  -- 멘토는 도울 수 있는 만큼 고를 수 있어 상한을 두지 않는다.
  mentoring_area text[] not null check (array_length(mentoring_area, 1) >= 1),
  current_majors text[] not null check (array_length(current_majors, 1) between 1 and 3),
  career_paths text[] not null check (array_length(career_paths, 1) between 1 and 3)
);

-- 매칭은 "이 캠퍼스를 지망하는 멘티"를 찾는 질의가 대부분이다.
create index if not exists mentor_profiles_campus_idx
  on public.mentor_profiles (current_campus);

-- ─────────────────────────────────────────────────────────────
-- matchings : 매칭 결과
-- ─────────────────────────────────────────────────────────────
create table if not exists public.matchings (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.users(id) on delete cascade,
  mentor_id uuid not null references public.users(id) on delete cascade,

  score int not null check (score between 0 and 100),
  -- 점수 근거를 남겨 두면 나중에 가중치를 바꿔도 과거 결과를 설명할 수 있다.
  breakdown jsonb not null,
  rank int not null check (rank >= 1),

  status matching_status not null default 'SUGGESTED',
  created_at timestamptz not null default now(),

  -- 같은 조합이 두 번 저장되지 않도록 한다.
  unique (mentee_id, mentor_id)
);

create index if not exists matchings_mentee_idx on public.matchings (mentee_id, rank);

-- ─────────────────────────────────────────────────────────────
-- 접근 제어
--
-- 이 앱에는 로그인이 없다. 브라우저가 DB에 직접 붙으면 멘토 1,000명의
-- 연락처가 그대로 노출되므로, 모든 접근을 Next.js 서버 라우트로만 허용한다.
-- 서버는 service_role 키를 쓰고 RLS를 우회한다.
--
-- 아래 정책은 anon/authenticated 키로는 아무것도 못 읽고 못 쓰게 만든다.
-- ─────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.mentee_profiles enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.matchings enable row level security;

-- 정책을 하나도 만들지 않으면 RLS가 켜진 상태에서 전부 거부된다.
-- (service_role 키는 RLS를 우회하므로 서버 라우트만 동작한다)

-- ─────────────────────────────────────────────────────────────
-- 확인용 질의
-- ─────────────────────────────────────────────────────────────
-- select role, count(*) from public.users group by role;
-- select count(*) from public.matchings;

-- ─────────────────────────────────────────────────────────────
-- 개인정보 동의 기록  (2026-09-03 추가)
--
-- 언제, 어떤 문구에 동의했는지 남긴다. 문구를 고치면 버전이 올라가므로
-- 나중에 "이 사람이 무엇에 동의했는지"를 되짚을 수 있다.
--
-- 기존 테이블에 추가하는 것이라 이 블록만 다시 실행해도 안전하다.
-- ─────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

-- 앞으로 들어오는 행은 동의 없이 저장될 수 없다.
-- 기존 행이 있으면 not null 을 걸 수 없으므로 체크 제약으로 처리한다.
do $$ begin
  alter table public.users
    add constraint users_consent_required
    check (consented_at is not null and consent_version is not null);
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- 중복 신청 방지  (2026-09-06 추가)
--
-- 같은 사람이 두 번 신청하면 매칭이 중복되고 인원 집계가 틀어진다.
-- 역할별로 잠그는 이유: 이론상 한 사람이 멘티와 멘토 양쪽일 수는 없지만,
-- 번호를 잘못 적은 경우까지 막으면 정정이 불가능해진다.
-- ─────────────────────────────────────────────────────────────
do $$ begin
  alter table public.users
    add constraint users_contact_role_unique unique (contact, role);
exception when duplicate_object then null; end $$;
