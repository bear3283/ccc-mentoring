# 행사 이후 할 일

2026-11-25 전체 점검에서 나온 항목 중, 채플(2026-11-26) 전에 손대지 않기로 한 것들.
행사 전날에 프레임워크·배포 방식·구조를 바꾸면 고치는 것보다 깨질 위험이 커서 미뤘다.

> 행사 전에 바로 고친 것(참고): 운영자 로그인이 성공까지 세어 행사장 Wi-Fi에서 10명째부터
> 막히던 것 → 틀린 시도만 30회/10분. 참여코드 조회 100회/10분 → 400회/10분.

우선순위 순서. 위에서부터 하면 된다.

---

## 1. Next.js 보안 패치 (15.5.28 → 15.5.29) — 높음

`npm audit` 중간 등급 3건. 이 서비스와 관련 있는 것은
**미들웨어(Edge)에서 HttpOnly 쿠키가 내부 응답 헤더로 노출될 수 있는 문제**
([GHSA-f3mh-rxg3-f5g2](https://github.com/advisories/GHSA-f3mh-rxg3-f5g2)) —
운영자 로그인 쿠키(`ccc_admin`)가 HttpOnly 이고 인증을 미들웨어가 한다.

```bash
git checkout -b chore/next-15.5.29
npm install next@15.5.29
npx tsc --noEmit && npm run build
npm start  # 다른 터미널
npm run verify:flow
npm audit --omit=dev   # 0건인지
```

패치 버전이라 바뀌는 것은 적지만, 운영자 화면 로그인·출석 체크·신청 흐름을 한 번씩 눌러 본다.

## 2. 배포를 GitHub `main` 에 묶기 — 높음

지금은 노트북에서 `npx vercel --prod` 로 **현재 폴더를 그대로** 올린다.

- 커밋하지 않은 파일도 운영에 나갈 수 있다.
- 협업자가 푸시해도 배포되지 않는다. `main` 과 운영 사이트가 어긋날 수 있다.
- 배포할 수 있는 사람이 이 노트북 하나다.

**할 일:** Vercel 대시보드 → Project → Settings → Git → GitHub 저장소 `bear3283/ccc-mentoring` 연결,
Production Branch = `main`. 이후에는 `main` 에 합치는 것이 곧 배포다. `vercel --prod` 는 쓰지 않는다.
브랜치를 푸시하면 미리보기(Preview) 주소가 생겨, 합치기 전에 실제 화면을 볼 수 있다.

> 미리보기 배포도 운영 DB 를 쓴다(환경변수가 같다면). 4번과 함께 미리보기 환경변수를 따로 두는 것을 고려.

## 3. `main` 보호와 PR 리뷰 — 중간

저장소가 **공개(public)** 인데 `main` 에 보호 규칙이 없다.

**할 일:** GitHub → Settings → Branches → `main` 에 규칙 추가
- Require a pull request before merging (리뷰 1명)
- Require status checks to pass (5번의 CI 를 만든 뒤)
- Block force pushes

협업자는 이미 브랜치로 올리고 있다(`fix/mentoring-login-guard`). 규칙만 걸면 된다.

## 4. 테스트용 DB 분리 — 중간

`npm run verify:flow` 가 **운영 DB** 에 `010-0099-` 번호로 테스트 데이터를 만들고 지운다.
지금까지 잘 지워졌지만, 운영 중에 돌리면 실제 명단·통계에 잠깐 섞이고 중간에 끊기면 남는다.

**할 일:** Supabase 에 테스트용 프로젝트를 하나 더 만들고 `supabase/schema.sql` + `supabase/migrations/*` 를
순서대로 적용. 로컬 검사는 그 프로젝트를 가리키는 `.env.test.local` 로 돌린다.
(`scripts/lib/env.ts` 가 어느 파일을 읽을지 고를 수 있게 해야 한다.)

## 5. CI 와 lint — 중간

- 자동 검사가 없다. 타입 검사·빌드·검사는 사람이 기억해서 돌린다.
- `npm run lint` 가 동작하지 않는다: ESLint 설정 파일(`eslint.config.*`)도, `eslint` 패키지도 없다.

**할 일:**
1. `npm install -D eslint eslint-config-next` 후 `eslint.config.mjs` 작성(Next 15 flat config). 처음 돌렸을 때 나오는 경고는 따로 정리.
2. `.github/workflows/ci.yml`: PR 마다 `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run build` → `npm run verify`(매칭 점수, 서버 불필요).
   `verify:flow` 는 4번의 테스트 DB 가 생긴 뒤에 CI 에 넣는다.

## 6. 운영자 API 에 권한 확인을 한 겹 더 — 중간

`/api/admin/*` 의 권한 확인은 `src/middleware.ts` 에만 있다. 각 라우트는 미들웨어가 막아 줬다고 믿는다.
미들웨어 `matcher` 를 실수로 바꾸거나 라우트를 다른 경로에 만들면 그대로 열린다.

**할 일:** `requireRole(request, ["admin"])` 같은 도우미를 `src/shared/lib/security/` 에 두고
각 운영자 라우트 첫 줄에서 부른다. 출석 라우트는 `["admin", "checkin"]`.

## 7. DB 변경 절차 정리 — 낮음

SQL 은 SQL Editor 에 사람이 붙여 넣고, "SQL 먼저, 배포는 그다음" 순서를 지켜야 한다.
`npm run check:db` 가 빠진 것을 잡아 준다.

**할 일:** 지금처럼 유지하되 `docs/DEPLOYMENT.md` 에 "새 마이그레이션이 있는 배포 체크리스트"
(SQL 실행 → `check:db` → 배포)를 한 곳에 적는다. 2번 이후에는 PR 설명에 마이그레이션 여부를 쓰게 한다.

## 8. 요청 횟수 제한을 공유 저장소로 — 낮음

`src/shared/lib/security/rateLimit.ts` 는 서버 메모리에만 센다. Vercel 인스턴스가 여러 개면 인스턴스마다
따로 세어, 실제 한도는 적힌 값의 몇 배다. 지금 규모에서는 감수했다.
트래픽이 커지거나 무차별 대입 흔적이 보이면 Upstash Redis(`@upstash/ratelimit`)로 옮긴다.

## 9. `repository.ts` 나누기 — 낮음

`src/features/signup/lib/repository.ts` 가 1,700줄이다. 등록·멘토링·매칭·운영자·출석이 한 파일에 있어
협업자와 같은 파일을 동시에 고치면 충돌이 잦다.

**할 일:** 기능별로 `signup.ts`, `mentoring.ts`, `matching.ts`, `admin.ts`, `checkin.ts` 로 나누고
공통(`getSupabase` 래핑, `logDbError`, 행 변환)은 `db.ts` 로. 동작은 바꾸지 않는 순수 이동이므로
`verify:flow` 가 그대로 통과하는지만 본다.

## 10. 브랜치 정리 — 낮음

합쳐진 브랜치가 로컬 28개, GitHub 15개 남아 있다.

```bash
git branch --merged main | grep -v '^\*\| main$' | xargs git branch -d
# GitHub: 합쳐진 브랜치만 골라 삭제 (Settings → "Automatically delete head branches" 도 켜기)
```

---

## 행사 후 데이터 정리 (별도)

개인정보 보관 기간과 삭제는 `docs/PRIVACY_REVIEW.md` 와 `npm run purge` 를 따른다.
출석 기록(`users.attended_at`)도 같은 행에 있어 함께 지워진다.
