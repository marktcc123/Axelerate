"use client";

import {
  useEffect,
  useRef,
  useState,
  createElement,
  useMemo,
  useCallback,
} from "react";
import type { ElementType, ReactNode } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

export type TextTypeVariableSpeed = { min: number; max: number };

export type TextTypeProps<T extends ElementType = "div"> = {
  /** 完整轮换文案；若与 `texts` 同时传入且 `text` 为字符串，则 `text` 作为固定前缀 */
  text?: string | string[];
  /** 轮换片段（与字符串形式的 `text` 组合为「前缀 + 片段」） */
  texts?: string[];
  as?: T;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  className?: string;
  prefixClassName?: string;
  contentClassName?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: string;
  cursorClassName?: string;
  cursorBlinkDuration?: number;
  textColors?: string[];
  variableSpeed?: TextTypeVariableSpeed;
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
  children?: ReactNode;
};

function resolveSegments(
  text?: string | string[],
  texts?: string[]
): { prefix: string; segments: string[] } {
  if (typeof text === "string" && texts && texts.length > 0) {
    return { prefix: text, segments: texts };
  }
  if (Array.isArray(text) && text.length > 0) {
    return { prefix: "", segments: text };
  }
  if (typeof text === "string" && text.length > 0) {
    return { prefix: "", segments: [text] };
  }
  if (texts && texts.length > 0) {
    return { prefix: "", segments: texts };
  }
  return { prefix: "", segments: [""] };
}

export default function TextType<T extends ElementType = "div">({
  text,
  texts,
  as: Component = "div" as T,
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  prefixClassName,
  contentClassName,
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  children: _children,
  ...props
}: TextTypeProps<T>) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const { prefix, segments } = useMemo(
    () => resolveSegments(text, texts),
    [text, texts]
  );

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return undefined;
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const el = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return;
    const el = cursorRef.current;
    gsap.set(el, { opacity: 1 });
    const tween = gsap.to(el, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [showCursor, cursorBlinkDuration]);

  const currentSegment = segments[currentTextIndex] ?? "";
  const processedText = useMemo(
    () =>
      reverseMode ? currentSegment.split("").reverse().join("") : currentSegment,
    [currentSegment, reverseMode]
  );

  useEffect(() => {
    if (!isVisible || segments.length === 0) return;

    let timeout: ReturnType<typeof setTimeout>;

    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === "") {
          setIsDeleting(false);
          if (currentTextIndex === segments.length - 1 && !loop) {
            return;
          }

          if (onSentenceComplete) {
            onSentenceComplete(segments[currentTextIndex] ?? "", currentTextIndex);
          }

          setCurrentTextIndex((prev) => (prev + 1) % segments.length);
          setCurrentCharIndex(0);
          timeout = setTimeout(() => {}, pauseDuration);
        } else {
          timeout = setTimeout(() => {
            setDisplayedText((prev) => prev.slice(0, -1));
          }, deletingSpeed);
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout(
            () => {
              setDisplayedText(
                (prev) => prev + processedText[currentCharIndex]
              );
              setCurrentCharIndex((prev) => prev + 1);
            },
            variableSpeed ? getRandomSpeed() : typingSpeed
          );
        } else if (segments.length >= 1) {
          if (!loop && currentTextIndex === segments.length - 1) return;
          timeout = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    };

    if (currentCharIndex === 0 && !isDeleting && displayedText === "") {
      timeout = setTimeout(executeTypingAnimation, initialDelay);
    } else {
      executeTypingAnimation();
    }

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors upstream typing loop deps
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    segments,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
    processedText,
    getRandomSpeed,
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping &&
    (currentCharIndex < processedText.length || isDeleting);

  const colorStyle = getCurrentTextColor()
    ? { color: getCurrentTextColor() }
    : undefined;

  const cursorEl = showCursor ? (
    <span
      key="text-type-cursor"
      ref={cursorRef}
      className={cn(
        "ml-1 inline-block opacity-100",
        cursorClassName,
        shouldHideCursor && "hidden"
      )}
      aria-hidden
    >
      {cursorCharacter}
    </span>
  ) : null;

  const contentEl = (
    <span
      key="text-type-content"
      className={cn(contentClassName)}
      style={colorStyle}
    >
      {displayedText}
    </span>
  );

  /** 有前缀时：上行正文居中，下行打字 + 光标作为一整行居中 */
  if (prefix) {
    return createElement(
      Component,
      {
        ref: containerRef,
        className: cn(
          "flex w-full max-w-full flex-col items-center gap-2 whitespace-pre-wrap text-center",
          className
        ),
        "aria-live": "polite",
        "aria-relevant": "text",
        ...props,
      } as Record<string, unknown>,
      <span className={cn("block w-full text-balance", prefixClassName)}>
        {prefix}
      </span>,
      <span className="inline-flex max-w-full flex-wrap items-baseline justify-center text-center">
        {contentEl}
        {cursorEl}
      </span>
    );
  }

  return createElement(
    Component,
    {
      ref: containerRef,
      className: cn(
        "inline-flex max-w-full flex-wrap items-baseline whitespace-pre-wrap",
        className
      ),
      "aria-live": "polite",
      "aria-relevant": "text",
      ...props,
    } as Record<string, unknown>,
    contentEl,
    cursorEl
  );
}
