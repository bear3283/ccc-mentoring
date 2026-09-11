"use client";

import { Name } from "@/components/ui/Name";
import { formatTimeSlotShort } from "@/shared/constants/domain";
import { PERSONAS } from "@/shared/constants/persona";
import { cn } from "@/shared/lib/cn";
import { nameInitials } from "@/shared/lib/nameInitials";
import type { PublicMatchResult } from "../model/types";

interface MentorCardProps {
  result: PublicMatchResult;
  onMatch: (result: PublicMatchResult) => void;
  /** 매칭을 요청해 공개된 전체 연락처. 없으면 가린 번호만 보인다. */
  revealedContact?: string;
  busy?: boolean;
  /** 이미 다른 선배와 매칭해서 고를 수 없는 상태. */
  locked?: boolean;
  /** 이 선배가 바로 내가 매칭한 상대. */
  settled?: boolean;
}

/**
 * 매칭 결과 프로필 카드.
 * 레퍼런스 이미지의 구조를 따른다:
 *   컬러 그라디언트 헤더 밴드 -> 밴드에 걸친 원형 아바타 -> 이름 -> 소속 -> 태그 행 -> 설명 -> CTA
 * 리스트가 아니라 카드인 이유: 멘토 한 명에 집중해서 보고 결정하게 만들기 위함.
 */
export function MentorCard({
  result,
  onMatch,
  revealedContact,
  busy,
  locked,
  settled,
}: MentorCardProps) {
  const { mentor, score, hashtags } = result;
  const persona = PERSONAS[mentor.personaType];
  const [from, to] = persona.gradient;

  return (
    <article
      data-card
      className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
    >
      {/* 헤더 밴드. 페르소나 색을 써서 카드가 여러 장 쌓여도 서로 구분된다. */}
      <div
        className="relative h-[92px]"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      >
        {/* 적합도는 카드에서 가장 먼저 읽혀야 하므로 헤더 위에 띄운다. */}
        <div className="absolute top-4 right-4 rounded-full bg-white/95 px-3 py-1.5">
          <span className="text-[15px] font-bold text-gray-900 tabular-nums">{score}%</span>
          <span className="ml-1 text-[12px] font-medium text-gray-500">적합</span>
        </div>

        {/* 아바타가 밴드 경계에 걸쳐 카드에 깊이를 준다. */}
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2">
          <div className="flex size-[72px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white text-[32px] shadow-sm">
            {mentor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mentor.photoUrl}
                alt={`${mentor.name} 멘토 프로필 사진`}
                className="size-full object-cover"
              />
            ) : (
              // 사진이 없으면 이름 글자로 채운다.
              // 페르소나 이모지를 쓰면 "사진 없는 사람"이 아니라 "그 성향인 사람"처럼 읽힌다.
              <span className="text-[26px] font-bold text-gray-400">
                {nameInitials(mentor.name)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pt-12 pb-5 text-center">
        <h3 className="text-[20px] font-bold tracking-[-0.02em] text-gray-900">
          <Name replayKey={mentor.id}>{mentor.name}</Name>
        </h3>
        <p className="mt-1 text-[14px] text-gray-500">
          {mentor.currentCampus} · {mentor.currentMajors.join(", ")} ·{" "}
          {String(mentor.admissionYear).slice(2)}학번
        </p>

        <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
          {hashtags.map((tag) => (
            <li
              key={tag}
              className={cn(
                "rounded-full px-2.5 py-1 text-[13px] font-semibold",
                "bg-brand-soft text-brand",
              )}
            >
              {tag}
            </li>
          ))}
        </ul>

        {/* 시간이 안 겹쳐도 후보에는 남지만, 모르고 연락하면 서로 곤란하다. */}
        {result.noTimeOverlap && (
          <p className="mt-4 rounded-xl bg-gray-100 px-3 py-2.5 text-[13px] leading-relaxed text-gray-600">
            ⏰ 서로 가능한 시간이 겹치지 않아요.
            <br />
            연락해서 일정을 맞추거나 온라인으로 만나보세요.
          </p>
        )}

        <p className="mt-4 text-[14px] leading-relaxed text-gray-600">
          {persona.keywords.join("·")} 있는 {persona.name}형 선배예요.
          <br />
          {mentor.mentoringArea.join(", ")} 쪽을 도와줄 수 있어요.
        </p>

        <dl className="mt-4 flex justify-center gap-5 border-t border-gray-100 pt-4">
          <div>
            <dt className="text-[12px] text-gray-400">진로</dt>
            <dd className="mt-0.5 text-[14px] font-semibold text-gray-700">
              {mentor.careerPaths.join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-gray-400">가능 시간</dt>
            <dd className="mt-0.5 text-[14px] font-semibold text-gray-700">
              {/* 개수만 보여주면 실제로 만날 수 있는지 판단이 안 된다. */}
              {mentor.availableTimes.slice(0, 2).map(formatTimeSlotShort).join(", ")}
              {mentor.availableTimes.length > 2 && ` 외 ${mentor.availableTimes.length - 2}`}
            </dd>
          </div>
        </dl>

        {revealedContact ? (
          // 요청이 기록된 뒤에만 전체 번호가 내려온다.
          <div className="mt-4 rounded-2xl bg-brand-soft px-4 py-4">
            <p className="text-[13px] font-semibold text-brand">연락처</p>
            <a
              href={`tel:${revealedContact.replace(/-/g, "")}`}
              className="mt-1 block font-mono text-[20px] font-bold tracking-wide text-gray-900"
            >
              {revealedContact}
            </a>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
              먼저 인사를 건네보세요. 연락처는 이 화면에서만 보여요.
            </p>
          </div>
        ) : (
          <>
            {/* 가린 번호를 미리 보여줘 "누구인지"는 알되 바로 연락은 못 하게 한다. */}
            <p className="mt-4 text-[13px] text-gray-400">
              연락처 <span className="font-mono tracking-wide">{mentor.maskedContact}</span>
              <br />
              매칭을 요청하면 전체 번호를 알려드려요.
            </p>

            <button
              type="button"
              onClick={() => onMatch(result)}
              disabled={busy || locked}
              className="mt-5 h-[52px] w-full rounded-2xl bg-brand text-[16px] font-bold text-white transition-colors duration-150 active:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-300"
            >
              {settled
                ? "연락처 다시 보기"
                : locked
                  ? "이미 다른 선배와 매칭했어요"
                  : busy
                    ? "요청 중…"
                    : "매칭하기"}
            </button>

            {/* 한 번 고르면 바꿀 수 없으므로 누르기 전에 알린다. */}
            {!locked && !settled && (
              <p className="mt-2 text-center text-[12px] text-gray-400">
                한 분과만 매칭돼요. 신중히 골라주세요.
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
