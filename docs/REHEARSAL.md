# 검증 가이드

일정이 확정되기 전이라도, 확인이 필요할 때마다 **예비 배포 → 검증 → 데이터 정리**를
반복할 수 있습니다. 이 문서는 그 절차입니다.

실제 오픈 일정과 순서는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 보세요.

---

## 0. 한눈에

```
① 예비 배포        Vercel 연결 (최초 1회, 이후 push 하면 자동)
② 사전 확인        npm run verify
③ 실기기 점검      폰으로 직접 (여기서만 드러나는 문제가 있음)
④ 운영진 리허설    10~20명이 실제로 신청서를 채움
⑤ 데이터 정리      npm run reset-data --yes
```

검증이 끝나면 배포는 그대로 두어도 되고 삭제해도 됩니다. 다시 필요할 때
`git push` 한 번이면 최신 상태로 돌아옵니다.

---

## 1. 예비 배포 (최초 1회)

### 왜 Vercel인가

GitHub Pages로는 안 됩니다. 이 앱은 신청 저장·매칭 계산에 서버가 필요한데
Pages는 정적 파일만 올립니다. Vercel은 Next.js를 그대로 실행합니다.

**Hobby 플랜 무료**라 예산이 확정되지 않아도 쓸 수 있습니다.

### 절차

1. [vercel.com](https://vercel.com) → **Continue with GitHub**
2. **Add New… → Project** → `bear3283/ccc-mentoring` 선택 → Import
3. 설정은 건드리지 않습니다. Next.js를 자동으로 인식합니다
4. **Environment Variables** 에 4개를 넣습니다 (`.env.local` 과 같은 값):

   | 이름 | 비고 |
   | --- | --- |
   | `SUPABASE_URL` | |
   | `SUPABASE_SERVICE_ROLE_KEY` | **`NEXT_PUBLIC_` 접두사 절대 금지** |
   | `ADMIN_PASSWORD` | |
   | `ADMIN_SESSION_SECRET` | |

5. **Deploy** → 1~2분 후 `https://ccc-mentoring.vercel.app` 형태의 주소가 나옵니다

이후로는 `git push` 할 때마다 자동으로 다시 배포됩니다.

### 주소 공개 범위

Hobby 플랜에는 비밀번호 보호가 없어 **주소를 아는 사람은 누구나 접속**할 수 있습니다.
다만 실질적인 위험은 낮습니다.

- 운영자 화면(`/admin`)은 이미 비밀번호로 잠겨 있습니다
- 링크를 운영진에게만 공유하면 외부인이 우연히 찾을 일은 없습니다
- 검색엔진 노출이 걱정되면 `robots.txt` 를 추가할 수 있습니다 (요청 시 작업)

---

## 2. 사전 확인 (배포 전, 로컬)

### 명령 정리

| 명령 | 무엇을 보는가 | 서버 필요 |
| --- | --- | --- |
| `npm run typecheck` | 타입 오류 | |
| `npm run build` | 빌드 | |
| `npm run check:db` | **DB 스키마가 코드와 맞는지** | |
| `npm run verify` | 매칭 알고리즘 28개 항목 (2,500조합 전수) | |
| `npm run verify:flow` | **API·DB·보안이 실제로 맞물려 도는지** | ✅ |
| `npm run reset-data` | 신청 데이터 삭제 | |
| `npm run purge -- --event-end YYYY-MM-DD` | 보유 기간 지난 데이터 파기 | |

### 순서

```bash
npm run typecheck
npm run build
npm run check:db        # 스키마가 안 맞으면 실행할 SQL을 알려줍니다
npm run verify

# 흐름 검증은 서버가 떠 있어야 합니다
npm start               # 다른 터미널에서
npm run verify:flow
```

### `check:db` 를 먼저 돌리는 이유

스키마 변경은 Supabase SQL Editor에서 **사람이 직접 실행**해야 합니다.
코드만 배포하고 SQL을 잊으면 **모든 신청이 실패**하는데, 화면에는
"저장하지 못했어요"만 나와서 원인을 알기 어렵습니다.

`check:db` 는 부족한 항목을 찾아 **실행할 SQL을 그대로 출력**합니다.
복사해서 SQL Editor에 붙여넣으면 됩니다.

### `verify:flow` 가 확인하는 것

실제 서버에 요청을 보내 24개 항목을 검사하고, 끝나면 만든 데이터를 스스로 지웁니다.

- 신청 저장 · 입력 검증 (연락처 형식, 동의 누락, 옛 동의 문구)
- 중복 신청 시 기존 코드 반환 / 같은 번호 다른 이름 거부
- 매칭 계산 · **응답에 전체 연락처가 없는지**
- 연락처 공개 · 매칭되지 않은 멘토 요청 거부 · 남의 코드로 요청 거부
- **1:1 매칭** — 두 번째 멘토 요청 거부 · 배정된 멘토가 다른 멘티 후보에서 제외 ·
  매칭 완료 후 재방문 시 자기 멘토 유지
- 참여코드 조회 · 번호 불일치 시 비공개
- `/admin` 차단 · 위조 쿠키 차단 · 틀린 비밀번호 거부

---

## 3. 실기기 점검 ★

**여기서만 드러나는 문제가 있습니다.** 지금까지의 검증은 전부 데스크톱
시뮬레이션이라 아래는 한 번도 실제로 확인된 적이 없습니다.

iPhone Safari와 Android Chrome **양쪽**에서 해보세요.

| 확인 | 왜 실기기여야 하는가 |
| --- | --- |
| 신청 8스텝 완주 | |
| **사진 "찍기"** | `capture="user"` 가 카메라를 여는지는 폰에서만 확인됨 |
| **사진 "고르기"** | 실제 사진은 2~5MB. 512px로 줄인 뒤 400KB 제한에 걸리지 않는지 |
| **참여코드 복사** | 클립보드 API는 HTTPS에서만 동작. localhost와 다름 |
| 키보드가 입력창을 가리는지 | 이름·연락처 입력 시 |
| 하단 CTA가 홈 인디케이터에 가리는지 | `env(safe-area-inset-bottom)` 실제 동작 |
| 매칭 결과의 전화번호 탭 | `tel:` 링크로 전화 앱이 열리는지 |
| 화면 회전 | 가로로 돌렸을 때 |

문제를 찾으면 아래 5번 양식으로 기록해 주세요.

---

## 4. 운영진 리허설

### 준비

멘토가 없으면 멘티가 "0명을 찾았어요"를 봅니다. **멘토 역할부터 채웁니다.**

```
① 운영진 절반이 "멘토로 시작하기" 로 신청   (최소 5명, 캠퍼스를 흩뿌려서)
② 나머지가 "멘티로 시작하기" 로 신청
③ 각자 매칭 결과를 확인
```

### 참가자 흐름에서 볼 것

- [ ] 질문 문구가 이해되는가. 되묻고 싶은 항목은 없는가
- [ ] **개인정보 동의 화면**에서 무엇에 동의하는지 알 수 있는가
- [ ] "최대 3개"인데 하나만 골라도 넘어가는 것이 자연스러운가
- [ ] 매칭 결과의 적합도(%)가 납득되는가
- [ ] **"한 분과만 매칭돼요"** 안내를 누르기 전에 인지하는가
- [ ] 매칭 후 화면을 다시 열었을 때 자기 멘토가 그대로 보이는가
- [ ] 참여코드를 어디에 저장해야 하는지 알겠는가
- [ ] 뒤로 갔다 와도 입력한 내용이 남아 있는가

### 운영자 흐름에서 볼 것

`/admin` 에 접속 (비밀번호 필요)

- [ ] 신청자 수가 실제와 맞는가
- [ ] 매칭 결과의 점수 근거(캠퍼스/영역/MBTI/…)로 순위가 설명되는가
- [ ] "요청함" 상태가 실제 요청한 건과 일치하는가
- [ ] **한 멘토가 두 건 이상 "요청함" 으로 잡혀 있지 않은가** (1:1 위반)
- [ ] CSV 내보내기가 엑셀에서 한글이 깨지지 않고 열리는가
- [ ] **미매칭 인원**이 있다면 어느 캠퍼스인가

### 코드 조회 흐름

- [ ] 다른 기기/시크릿 창에서 `/lookup` → 이름+연락처로 코드를 찾을 수 있는가
- [ ] 번호를 틀리게 넣으면 알려주지 않는가

---

## 5. 문제 기록 양식

찾은 문제는 GitHub Issues 또는 아래 형식으로 모아 주세요.
**재현 방법이 가장 중요합니다.**

```
[화면]      매칭 결과
[기기]      iPhone 14 / iOS 18 / Safari
[무엇을]    카드의 '매칭하기'를 눌렀는데
[어떻게 됨]  아무 반응이 없음
[기대]      연락처가 보여야 함
[재현]      매번 / 가끔 (몇 번 중 몇 번)
```

---

## 6. 데이터 정리

리허설이 끝나면 테스트 신청을 지웁니다.

```bash
npm run reset-data          # 무엇이 지워질지 먼저 확인
npm run reset-data -- --yes # 실제 삭제
```

먼저 목록을 보여주고, `--yes` 를 붙여야 지워집니다. 실수로 운영 중에 돌려도
한 번은 멈춥니다. 매칭 기록은 외래키로 함께 삭제됩니다.

> **운영 중에는 절대 실행하지 마세요.** 되돌릴 수 없습니다.

---

## 7. 아직 반영이 필요한 것

### 개인정보 동의 — DB 작업 남음

동의 화면과 서버 검증은 만들었지만, **DB 컬럼이 아직 추가되지 않았습니다.**
Supabase → SQL Editor 에서 아래를 실행해야 신청이 저장됩니다.

```sql
alter table public.users
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

do $$ begin
  alter table public.users
    add constraint users_consent_required
    check (consented_at is not null and consent_version is not null);
exception when duplicate_object then null; end $$;
```

동의 문구(`src/shared/constants/privacy.ts`)는 **법률 검토를 받지 않은 초안**입니다.
실제 오픈 전 담당자 확인이 필요합니다. 특히 확정해야 할 것:

- 보유 기간 (현재 초안: 행사 종료 후 90일)
- 문의 창구 (현재 초안: "행사 운영진")

문구를 고치면 `CONSENT_VERSION` 을 함께 올려야 합니다. 그래야 "누가 어떤 문구에
동의했는지"가 기록으로 남습니다.

### 1:1 매칭 — DB 작업 남음

멘토 한 명은 후배 한 명과만 연결됩니다. 코드에서도 막지만, 두 멘티가 같은 순간에
'매칭하기'를 누르면 둘 다 통과합니다. **마지막 방어선은 DB 인덱스뿐**이라
아래를 실행해야 합니다.

```sql
create unique index if not exists matchings_mentor_taken_unique
  on public.matchings (mentor_id)
  where status in ('REQUESTED', 'CONFIRMED');

create unique index if not exists matchings_mentee_taken_unique
  on public.matchings (mentee_id)
  where status in ('REQUESTED', 'CONFIRMED');
```

적용 여부는 `npm run check:db` 로 확인됩니다.

> **운영상 주의**: 멘토가 부족하면 뒤늦게 신청한 멘티가 "0명"을 보게 됩니다.
> 1:1 이전에는 인기 멘토에게 여러 멘티가 몰려도 모두 결과를 봤지만, 이제는
> **멘토 수가 멘티 수의 상한**입니다. 운영 중 `/admin` 의 미매칭 인원을 주기적으로
> 확인하세요.

### 그 외

| 항목 | 상태 |
| --- | --- |
| 데이터 파기 절차 | 정책 결정 필요 (보유 기간이 지난 데이터 자동 삭제) |
| 중복 신청 방지 | 같은 연락처로 여러 번 신청 가능 |
| 구글 시트 연동 | 미착수 |
| 사진 저장소 | 현재 DB에 data URL로 직접 저장. 1,300명 기준 약 78MB |
| 속도 제한 | 서버 인스턴스별로 따로 셈 (Vercel은 인스턴스가 여러 개) |
