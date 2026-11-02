-- ═══════════════════════════════════════════════════════════
-- 대학생 행사 등록(1단계)에서 캠퍼스·학번을 받는다
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다. 기존 행은 비어 있는 채로 남습니다.
--
-- 순서가 중요합니다: 이 SQL을 먼저 실행하고 코드를 배포하세요.
-- 코드가 먼저 나가면 대학생 등록과 운영자 화면이 새 컬럼이 없어 실패합니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- mentor_profiles 에 두지 않는 이유: 그 테이블은 멘토링 영역·전공이 NOT NULL 이라
-- 멘토를 신청하지 않은 대학생은 행을 만들 수 없다. 멘토 신청(2단계)을 하면
-- mentor_profiles 에도 같은 값이 저장되고, 매칭은 그쪽 값을 쓴다.
alter table public.users
  add column if not exists current_campus text,
  add column if not exists admission_year int;

do $$ begin
  alter table public.users
    add constraint users_admission_year_range
    check (admission_year is null or admission_year between 2010 and 2040);
exception when duplicate_object then null; end $$;
