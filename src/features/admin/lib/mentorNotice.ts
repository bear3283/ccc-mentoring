/**
 * 선배에게 보내는 매칭 알림 문자.
 *
 * 후배가 선배를 골라도 선배에게는 자동 알림이 가지 않는다(문자 업체를 쓰지 않는다).
 * 운영자가 직접 보내는데, 보내는 길이 둘이다.
 *   - 운영자 화면의 "선배 알림" 탭: 휴대폰 문자 앱을 문구가 채워진 채로 연다
 *   - scripts/notify-mentors.ts: 맥의 메시지 앱으로 여러 건을 차례로 보낸다
 * 두 길이 같은 문구를 쓰도록 여기 한 곳에 둔다. 서버·브라우저·스크립트 어디서나
 * 불러야 해서 DB나 서버 전용 모듈에 의존하지 않는다.
 */

/**
 * 선배가 문자를 받고 여는 주소.
 *
 * 배포 주소가 바뀌면 여기만 고친다. 운영자 화면은 접속한 주소를 알 수 있지만
 * 스크립트는 모르므로, 같은 값을 쓰려고 상수로 둔다.
 */
export const APP_ORIGIN = "https://ccc-mentoring.vercel.app";

export interface MentorNoticeInput {
  menteeName: string;
  mentorName: string;
  /** 선배 본인의 참여코드. 확인 화면에서 넣어야 해서 함께 적는다. */
  mentorCode: string;
}

/**
 * 선배 본인 확인 화면으로 바로 가는 링크. 누르면 코드가 채워져 곧장 확인된다.
 *
 * 코드는 #뒤에 둔다. ?code= 로 두면 서버 접속 기록에 남는데, 이 코드로
 * 후배 연락처를 볼 수 있다. #뒤는 브라우저 안에서만 읽힌다.
 */
export function mentorCheckUrl(mentorCode: string): string {
  return `${APP_ORIGIN}/mentor/match#${mentorCode}`;
}

/**
 * 문자 본문. 후배 번호는 넣지 않는다.
 *
 * 문자는 잘못된 번호로 갈 수도 있고 오래 남는다. 번호는 참여코드로 확인하는
 * 화면에서만 보여주고, 문자에는 누가 골랐는지와 바로 확인하는 링크만 쓴다.
 * 링크가 안 열리는 경우에 대비해 참여코드도 따로 적는다.
 */
export function mentorNoticeText({ menteeName, mentorName, mentorCode }: MentorNoticeInput): string {
  return [
    `[고3채플] ${mentorName} 선배님, ${menteeName} 후배가 선배님을 멘토로 골랐어요.`,
    `아래 링크를 누르면 후배 연락처와 채플 날 도착 시간이 바로 보여요.`,
    mentorCheckUrl(mentorCode),
    `(참여코드 ${mentorCode})`,
  ].join("\n");
}

/**
 * 문구가 채워진 문자 앱 링크.
 *
 * `?&body=` 는 iOS(`&body=`)와 안드로이드(`?body=`)가 모두 읽는 모양이다.
 * 앱의 다른 문자 버튼과 같은 방식이다.
 */
export function smsHref(contact: string, body: string): string {
  return `sms:${contact.replace(/-/g, "")}?&body=${encodeURIComponent(body)}`;
}
