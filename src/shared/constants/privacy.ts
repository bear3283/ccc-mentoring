/**
 * 개인정보 동의 문구.
 *
 * 이 파일이 동의 화면·전문 페이지·DB 기록의 단일 출처다.
 * 문구를 고치면 CONSENT_VERSION 을 올려야 한다. 그래야 "이 사람이 어떤 문구에
 * 동의했는지"를 나중에 확인할 수 있다.
 *
 * ⚠️ 법률 검토를 받지 않은 초안이다. 실제 오픈 전 담당자 확인이 필요하다.
 */

/** 문구를 수정하면 반드시 올린다. DB의 consent_version 에 함께 저장된다. */
export const CONSENT_VERSION = "2026-09-03";

/** 행사 종료 후 보관 기간. 문구와 파기 절차가 같은 값을 봐야 한다. */
export const RETENTION_DAYS = 90;

export interface ConsentItem {
  id: "collect" | "thirdParty";
  /** 체크박스 옆 한 줄 */
  label: string;
  /** 필수 동의 여부. 둘 다 없으면 매칭이 성립하지 않는다. */
  required: true;
  /** 펼쳤을 때 보이는 표 */
  table: { term: string; detail: string }[];
  /** 표 아래 덧붙이는 안내 */
  notice: string;
}

const COLLECTED_ITEMS = "이름, 연락처, 성별, 참여 가능 시간대, 관심 분야, 지망 캠퍼스, 희망 학과·진로, 성향 정보(성경 인물·MBTI)";
const OPTIONAL_ITEMS = "출신 고등학교, 추천인, 프로필 사진, 학번(멘토)";

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "collect",
    label: "개인정보 수집·이용에 동의합니다",
    required: true,
    table: [
      { term: "수집 목적", detail: "멘토-멘티 매칭, 매칭 결과 안내, 행사 운영" },
      { term: "필수 항목", detail: COLLECTED_ITEMS },
      { term: "선택 항목", detail: `${OPTIONAL_ITEMS} (입력하지 않아도 신청할 수 있어요)` },
      {
        term: "보유 기간",
        detail: `행사 종료 후 ${RETENTION_DAYS}일까지 보관하고 지체 없이 파기합니다`,
      },
    ],
    notice:
      "동의를 거부하실 수 있습니다. 다만 이름과 연락처가 없으면 매칭된 상대와 연결해 드릴 수 없어 신청이 어렵습니다.",
  },
  {
    id: "thirdParty",
    label: "매칭된 상대에게 내 정보가 제공되는 것에 동의합니다",
    required: true,
    table: [
      { term: "제공받는 사람", detail: "나와 매칭된 멘토 또는 멘티" },
      {
        term: "제공 항목",
        detail: "이름, 캠퍼스·학과 등 프로필 정보, 프로필 사진(등록한 경우), 연락처",
      },
      {
        term: "제공 시점",
        detail: "연락처는 상대가 '매칭하기'를 눌러 요청한 뒤에만 공개됩니다. 그 전에는 010-****-5678 처럼 가려서 보입니다",
      },
      { term: "제공 목적", detail: "멘토링을 위한 상호 연락" },
      { term: "보유 기간", detail: "위 수집·이용 동의와 같습니다" },
    ],
    notice:
      "동의를 거부하실 수 있습니다. 다만 서로 연락할 수 없으면 매칭의 의미가 없어 신청이 어렵습니다.",
  },
];

/** 신청 자격. 만 14세 미만은 법정대리인 동의가 필요해 이 서비스에서는 받지 않는다. */
export const AGE_NOTICE = "만 14세 이상만 신청할 수 있어요.";

/** 문의 창구. 실제 값으로 교체해야 한다. */
export const CONTACT_FOR_PRIVACY = "행사 운영진";
