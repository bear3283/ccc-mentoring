-- ═══════════════════════════════════════════════════════════
-- 채플 당일(목) 도착 시간
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
--
-- 순서가 중요합니다: 이 SQL을 먼저 실행하고 코드를 배포하세요.
-- 코드가 먼저 나가면 멘토링 신청과 매칭 요청이 event_arrival 컬럼이 없어 실패합니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- 채플 날은 매칭된 선배·후배가 인사하는 자리다. 1:1 멘토링 시간(available_times)과는
-- 다른 질문이라 따로 받는다. 채플이 지난 뒤 신청한 사람과 이전 신청자는 비어 있다.
alter table public.users
  add column if not exists event_arrival text;

-- 코드의 EVENT_ARRIVALS(src/shared/constants/venue.ts)와 같은 값이어야 한다.
do $$ begin
  alter table public.users
    add constraint users_event_arrival_check
    check (event_arrival is null
      or event_arrival in ('1700', '1730', '1800', '1830', '1900_LATER', 'ABSENT'));
exception when duplicate_object then null; end $$;
