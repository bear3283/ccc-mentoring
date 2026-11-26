import { EVENT_DATE_LABEL, isAfterEvent } from "@/shared/constants/venue";

export interface MentoringInvite {
  title: string;
  body: string;
  points: { emoji: string; text: string }[];
  cta: string;
  footnote: string;
}

/**
 * 등록만 하고 멘토링을 신청하지 않은 사람에게 보여 줄 권유 문구.
 * 등록 완료 화면과 참여코드 조회 화면이 같은 말을 쓰도록 한 곳에 둔다.
 *
 * "멘토링"은 참가자에게 익숙한 말이 아니다. 그대로 두면 부가 행사처럼 들린다.
 * 실제로는 선배와 만나 이야기하는 시간이므로, 이름 대신 무슨 일이 일어나는지로 설명한다.
 *
 * 멘토링 신청은 채플이 끝난 뒤에도 계속 열어 둔다. 다만 "채플 당일에 만나요"를
 * 그대로 두면 이미 지난 날을 기다리라는 말이 되므로 날짜를 전제하는 문장만 갈라 준다.
 */
export function mentoringInvite(role: "MENTEE" | "MENTOR"): MentoringInvite {
  const passed = isAfterEvent();
  // 채플 날은 인사하는 자리다. 채플이 지나면 이 줄은 빠진다.
  const meetingPoint = { emoji: "⛪", text: `${EVENT_DATE_LABEL} 채플에서 얼굴 보고 인사해요` };
  const meetOnce = {
    emoji: "📅",
    text: passed ? "약속을 잡고 1회 만남을 가져요" : "채플 이후에 약속을 잡고 1회 만남을 가져요",
  };

  if (role === "MENTEE") {
    return {
      title: "선배와 이어드릴까요?",
      // 만남은 채플 이후에 약속을 잡아 한 번 한다. 채플 날은 얼굴을 익히는 인사 자리다.
      body: passed
        ? "대학에 먼저 간 CCC 선배와 짝이 되어요. 문자로 인사하고, 약속을 잡아 한 번 만나 이야기 나눠요."
        : `대학에 먼저 간 CCC 선배와 짝이 되어요. ${EVENT_DATE_LABEL} 채플에서 인사하고, 채플 이후에 약속을 잡아 한 번 만나요.`,
      points: [
        { emoji: "💬", text: "전공·입시 뒤의 생활, 궁금한 걸 편하게 물어봐요" },
        ...(passed ? [] : [meetingPoint]),
        meetOnce,
      ],
      cta: "멘토링 신청하기",
      footnote: "3분이면 끝나요. 신청은 선착순이 아니에요.",
    };
  }

  /*
   * CCC 대학생에게는 "한 영혼 품기 운동"으로 권한다. 짝을 맞춰 주는 서비스가 아니라
   * 고3·예비 27학번 한 명을 맡아 품는 운동에 참여하는 것이라는 뜻을 먼저 전한다.
   */
  return {
    title: "한 영혼 품기 운동에 함께해요",
    body: passed
      ? "고3·예비 27학번 후배 한 명을 품어 주세요. 먼저 대학에 간 선배로서 문자로 인사하고, 약속을 잡아 한 번 만나요."
      : `고3·예비 27학번 후배 한 명을 품어 주세요. ${EVENT_DATE_LABEL} 채플에서 인사하고, 채플 이후에 약속을 잡아 한 번 만나요.`,
    points: [
      { emoji: "🙏", text: "후배 한 영혼을 마음에 품고 기도해 주세요" },
      { emoji: "💬", text: "먼저 걸어온 대학 생활과 신앙 이야기를 들려주세요" },
      ...(passed ? [] : [meetingPoint]),
      meetOnce,
    ],
    cta: "멘토로 신청하기",
    footnote: "3분이면 끝나요. 캠퍼스 확인을 거쳐 후배에게 소개돼요.",
  };
}
