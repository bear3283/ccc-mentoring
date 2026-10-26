/**
 * 아직 알리지 않은 선배에게 맥의 메시지 앱으로 매칭 알림 문자를 보낸다.
 *
 * 문자 업체를 쓰지 않는다. 운영자의 아이폰에서 "문자 메시지 전달"을 이 맥으로
 * 켜 두면, 메시지 앱이 그 아이폰 번호로 문자를 보낸다.
 *   아이폰 설정 → 메시지 → 문자 메시지 전달 → 이 맥 켜기
 *
 * 보내는 동안 아이폰의 잠금을 풀고 메시지 앱을 열어 둔다. 아이폰이 잠겨 쉬고 있으면
 * 맥이 넘긴 문자가 나가지 않고 기다리다가, 아이폰에서 메시지 앱을 여는 순간에야
 * 한꺼번에 나간다(2026-10-26 실측). 아이폰은 맥 가까이, 같은 Wi-Fi 에 둔다.
 *
 * 실행:
 *   npm run notify:mentors                         # 보낼 목록과 문구만 확인
 *   npm run notify:mentors -- --test 010-1234-5678 # 다른 사람 번호로 한 통만 시험 (기록 안 함)
 *
 * 시험은 운영자 본인 번호가 아니라 동의한 다른 사람 번호로 한다. 아이폰이 자기
 * 번호로 문자를 보내면 맥에서 진행 막대가 멈춘 채 나가지 않는다(실측). 본인 번호가
 * iMessage 에 등록돼 있으면 문자 대신 iMessage(파란 말풍선)로 가서 시험이 되지도 않는다.
 *   npm run notify:mentors -- --send               # 실제로 보내고 기록 (기본 최대 10건)
 *   npm run notify:mentors -- --send --limit 30
 *
 * 한 번에 많이 보내면 통신사가 스팸으로 막을 수 있어 건마다 쉬고 건수를 제한한다.
 * 보낸 건은 운영자 화면 "선배 알림" 탭에 "맥 메시지 앱"으로 기록된다.
 */
import { execFileSync } from "node:child_process";
import { mentorNoticeText } from "../src/features/admin/lib/mentorNotice";
import { supabaseAccess } from "./lib/env";

const { url, headers } = supabaseAccess();

const RELAY_HINT =
  "아이폰 잠금을 풀고 메시지 앱을 열어 두세요. 잠겨 있으면 메시지 앱을 열 때까지 나가지 않습니다.";
const args = process.argv.slice(2);

const send = args.includes("--send");
const testTo = valueOf("--test");
const limit = Number(valueOf("--limit") ?? 10);
/** 건 사이 쉬는 시간. 짧게 몰아 보내면 스팸으로 분류되기 쉽다. */
const PAUSE_MS = 4000;

function valueOf(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

interface Pending {
  id: string;
  mentee: { name: string } | null;
  mentor: { name: string; contact: string; participation_code: string } | null;
}

/** 010-1234-5678 → +821012345678. 메시지 앱은 국가번호가 붙은 번호를 확실히 찾는다. */
function toE164(contact: string): string {
  const digits = contact.replace(/\D/g, "");
  return `+82${digits.slice(1)}`;
}

/**
 * 메시지 앱으로 문자 한 통.
 *
 * 번호와 본문은 osascript 인자로 넘긴다. 스크립트 문자열에 끼워 넣으면
 * 이름에 따옴표가 섞였을 때 AppleScript 가 깨지거나 엉뚱한 명령이 된다.
 */
function sendViaMessages(phone: string, body: string): void {
  const script = `
on run argv
  set targetPhone to item 1 of argv
  set targetBody to item 2 of argv
  tell application "Messages"
    set smsAccount to 1st account whose service type = SMS
    set targetChat to participant targetPhone of smsAccount
    send targetBody to targetChat
  end tell
end run`;
  execFileSync("osascript", ["-e", script, phone, body], { stdio: "pipe" });
}

async function markNotified(id: string): Promise<boolean> {
  // 이미 기록된 건은 건드리지 않는다. 그 사이 운영자 화면에서 보냈을 수 있다.
  const res = await fetch(
    `${url}/rest/v1/matchings?id=eq.${id}&mentor_notified_at=is.null`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        mentor_notified_at: new Date().toISOString(),
        mentor_notified_via: "MAC_MESSAGES",
      }),
    },
  );
  return res.ok && ((await res.json()) as unknown[]).length === 1;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if ((send || testTo) && process.platform !== "darwin") {
    console.error("메시지 앱으로 보내는 것은 맥에서만 됩니다. 목록 확인은 어디서나 됩니다.");
    process.exit(1);
  }

  if (testTo) {
    if (!/^01[016-9]-?\d{3,4}-?\d{4}$/.test(testTo)) {
      console.error(`번호 형식을 확인하세요: ${testTo}`);
      process.exit(1);
    }
    const body = mentorNoticeText({ menteeName: "홍길동", mentorName: "시험", mentorCode: "TEST00" });
    sendViaMessages(toE164(testTo), body);
    // 메시지 앱에 넘긴 것까지만 알 수 있다. 아이폰을 거쳐 실제로 나갔는지는 모른다.
    console.log(`시험 문자를 ${testTo} 앞으로 메시지 앱에 넘겼습니다.`);
    console.log("실제로 나갔는지는 아래로 확인하세요:");
    console.log("  · 받는 휴대폰에 문자가 왔는지");
    console.log("  · 맥 메시지 앱의 그 말풍선에 빨간 느낌표(!)가 없는지");
    console.log(RELAY_HINT);
    console.log("안 갔다면 아이폰 → 설정 → 메시지 → 문자 메시지 전달에서 이 맥을 껐다 켜 보세요.");
    return;
  }

  const res = await fetch(
    `${url}/rest/v1/matchings?select=id,mentee:mentee_id(name),mentor:mentor_id(name,contact,participation_code)` +
      `&status=in.(REQUESTED,CONFIRMED)&mentor_notified_at=is.null&order=created_at.asc`,
    { headers },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(`조회 실패: HTTP ${res.status}`);
    if (text.includes("mentor_notified_at")) {
      console.error("알림 기록 컬럼이 없습니다. supabase/migrations/2026-10-20-mentor-notice.sql 을 먼저 실행하세요.");
    }
    process.exit(1);
  }

  const pending = ((await res.json()) as Pending[]).filter((p) => p.mentee && p.mentor);

  if (pending.length === 0) {
    console.log("알릴 선배가 없습니다.");
    return;
  }

  const batch = pending.slice(0, limit);
  console.log(`알릴 선배 ${pending.length}명${pending.length > batch.length ? ` (이번에 ${batch.length}명)` : ""}`);
  console.log("─".repeat(56));
  for (const p of batch) {
    console.log(`  ${p.mentor!.name} (${p.mentor!.contact}) ← 후배 ${p.mentee!.name}`);
  }
  console.log("─".repeat(56));
  console.log("문구 예시:\n");
  console.log(
    mentorNoticeText({
      menteeName: batch[0].mentee!.name,
      mentorName: batch[0].mentor!.name,
      mentorCode: batch[0].mentor!.participation_code,
    })
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  );

  if (!send) {
    console.log("\n확인만 했습니다. 보내려면 --send 를 붙이세요:");
    console.log("  npm run notify:mentors -- --send");
    return;
  }

  // 아이폰이 잠겨 있으면 맥이 넘긴 문자가 쌓여 있다가 나중에 한꺼번에 나간다.
  console.log("\n" + RELAY_HINT);
  console.log("");
  let sent = 0;
  for (const [i, p] of batch.entries()) {
    const body = mentorNoticeText({
      menteeName: p.mentee!.name,
      mentorName: p.mentor!.name,
      mentorCode: p.mentor!.participation_code,
    });
    try {
      sendViaMessages(toE164(p.mentor!.contact), body);
    } catch (e) {
      // 한 건이 실패하면 멈춘다. 같은 원인(전달 설정 꺼짐 등)으로 나머지도 실패한다.
      console.error(`  ✗ ${p.mentor!.name} 보내기 실패 — 여기서 멈춥니다.`);
      console.error(`    ${e instanceof Error ? e.message.split("\n")[0] : e}`);
      break;
    }
    const recorded = await markNotified(p.id);
    sent++;
    console.log(`  → ${p.mentor!.name}${recorded ? "" : " (넘겼지만 기록은 이미 있거나 실패 — 운영자 화면 확인)"}`);
    if (i < batch.length - 1) await sleep(PAUSE_MS);
  }

  // 기록은 "메시지 앱에 넘김" 기준이다. 실제 전송 실패는 메시지 앱에서만 보인다.
  console.log(`\n${sent}건을 메시지 앱에 넘기고 "알림 보냄"으로 기록했습니다.`);
  console.log("맥 메시지 앱에서 빨간 느낌표(!)가 붙은 말풍선이 있는지 꼭 확인하세요.");
  console.log('느낌표가 있는 선배는 운영자 화면 "선배 알림" 탭에서 되돌리기 후 다시 보내면 됩니다.');
}

void main();
