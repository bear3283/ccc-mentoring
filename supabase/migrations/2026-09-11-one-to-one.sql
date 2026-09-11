-- ═══════════════════════════════════════════════════════════
-- 1:1 매칭 강제
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════

-- 한 멘토는 한 명에게만 배정된다.
-- 부분 유니크 인덱스라 추천(SUGGESTED) 상태는 여러 건 있어도 되고,
-- 실제로 성사된(REQUESTED/CONFIRMED) 건만 하나로 제한된다.
--
-- 코드에서 "이미 매칭됐는지" 확인하는 것만으로는 부족하다.
-- 두 멘티가 같은 순간에 누르면 둘 다 통과해버린다.
create unique index if not exists matchings_mentor_taken_unique
  on public.matchings (mentor_id)
  where status in ('REQUESTED', 'CONFIRMED');

-- 한 멘티도 한 명만 고를 수 있다.
create unique index if not exists matchings_mentee_taken_unique
  on public.matchings (mentee_id)
  where status in ('REQUESTED', 'CONFIRMED');
