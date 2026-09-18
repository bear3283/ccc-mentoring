-- 성경 인물 선택지를 4개에서 8개로 넓힌다.
--
-- 넷만 두었을 때는 "넷 중엔 이게 제일 가깝네" 로 고르게 되어
-- 성향 정보로서의 값이 떨어졌다.
--
-- enum 값 추가는 되돌릴 수 없다(PostgreSQL 은 enum 값 삭제를 지원하지 않는다).
-- 다만 값을 더하기만 하므로 기존 행은 그대로 있고 코드도 계속 동작한다.
--
-- ALTER TYPE ... ADD VALUE 는 트랜잭션 블록 안에서 실행할 수 없어
-- do $$ ... $$ 로 감싸지 않고 한 줄씩 둔다. 이미 있으면 건너뛴다.

alter type persona_type add value if not exists 'NEHEMIAH';
alter type persona_type add value if not exists 'DANIEL';
alter type persona_type add value if not exists 'RUTH';
alter type persona_type add value if not exists 'DEBORAH';
