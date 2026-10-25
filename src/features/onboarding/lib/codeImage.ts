import { EVENT_POSTER } from "@/shared/constants/venue";

/**
 * 참여코드 이미지. 포스터 위 가운데에 코드를 크게 얹는다.
 *
 * 사진첩에 남겨 두면 코드를 받아 적거나 복사해 둘 필요가 없고, 행사 날까지
 * 포스터와 함께 다시 꺼내 보기 쉽다. 브라우저 안에서만 그리고 서버로 보내지 않는다.
 *
 * 카드 위치는 포스터에 맞춘 값이다(1080×1350 기준). 위쪽 글씨(~330px)와
 * 아래쪽 RE:CHILL 글씨(~780px) 사이의 불꽃 부분에 놓는다. 포스터를 바꾸면 확인한다.
 */
const WIDTH = 1080;
const HEIGHT = 1350;
const CARD = { x: 150, y: 370, w: 780, h: 380, r: 48 };

const BRAND = "#bf4e2b";
const SANS = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export async function renderCodeImage(code: string, name: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  if (EVENT_POSTER) {
    ctx.drawImage(await loadImage(EVENT_POSTER.src), 0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = "#fbe8dd";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // 카드. 포스터가 비쳐 보이되 코드는 또렷하게 읽히는 정도로 덮는다.
  ctx.save();
  ctx.shadowColor = "rgba(120, 40, 10, 0.25)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
  ctx.beginPath();
  ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fill();
  ctx.restore();

  const cx = WIDTH / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = BRAND;
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText("고3초청채플 참여코드", cx, CARD.y + 80);

  // 글자 사이를 고르게 벌린다. letterSpacing 은 아직 모든 브라우저에 있지 않다.
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `800 132px ${MONO}`;
  const step = 108;
  const startX = cx - (step * (code.length - 1)) / 2;
  [...code].forEach((ch, i) => ctx.fillText(ch, startX + step * i, CARD.y + 235));

  ctx.fillStyle = "#333";
  ctx.font = `700 42px ${SANS}`;
  ctx.fillText(`${name}님`, cx, CARD.y + 305);

  // 코드만 있으면 매칭된 상대의 연락처를 볼 수 있다. SNS 에 올리지 않게 이미지에도 적는다.
  ctx.fillStyle = "#888";
  ctx.font = `500 28px ${SANS}`;
  ctx.fillText("다른 사람에게 보여주지 마세요", cx, CARD.y + 352);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
