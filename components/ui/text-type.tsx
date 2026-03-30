"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TextTypeProps {
  /** Lines to cycle (React Bits style) */
  text?: string[];
  /** Alias / alternate prop name; takes precedence over `text` when provided */
  texts?: string[];
  typingSpeed?: number;
  pauseDuration?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  deletingSpeed?: number;
  variableSpeedEnabled?: boolean;
  variableSpeedMin?: number;
  variableSpeedMax?: number;
  /** Cursor blink period in seconds */
  cursorBlinkDuration?: number;
  className?: string;
}

function resolveLines(text?: string[], texts?: string[]): string[] {
  const raw = texts != null && texts.length > 0 ? texts : text ?? [];
  return raw.filter((s) => s.length > 0);
}

export default function TextType({
  text,
  texts,
  typingSpeed = 75,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = "_",
  deletingSpeed = 50,
  variableSpeedEnabled = false,
  variableSpeedMin = 60,
  variableSpeedMax = 120,
  cursorBlinkDuration = 0.5,
  className,
}: TextTypeProps) {
  const lines = useMemo(() => resolveLines(text, texts), [text, texts]);
  const [displayed, setDisplayed] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linesKey = useMemo(() => lines.join("\u0000"), [lines]);

  useEffect(() => {
    if (lines.length === 0) {
      setDisplayed("");
      return;
    }

    let cancelled = false;

    const clearTimer = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const delay = (base: number) => {
      if (!variableSpeedEnabled) return base;
      const lo = Math.min(variableSpeedMin, variableSpeedMax);
      const hi = Math.max(variableSpeedMin, variableSpeedMax);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    };

    const state = {
      strIdx: 0,
      charIdx: 0,
      mode: "typing" as "typing" | "pause" | "deleting",
    };

    const schedule = (fn: () => void, ms: number) => {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const step = () => {
      if (cancelled || lines.length === 0) return;
      const full = lines[state.strIdx % lines.length]!;

      if (state.mode === "typing") {
        if (state.charIdx < full.length) {
          state.charIdx += 1;
          setDisplayed(full.slice(0, state.charIdx));
          schedule(step, delay(typingSpeed));
        } else {
          state.mode = "pause";
          schedule(() => {
            state.mode = "deleting";
            step();
          }, pauseDuration);
        }
        return;
      }

      if (state.mode === "deleting") {
        if (state.charIdx > 0) {
          state.charIdx -= 1;
          setDisplayed(full.slice(0, state.charIdx));
          schedule(step, deletingSpeed);
        } else {
          state.strIdx = (state.strIdx + 1) % lines.length;
          state.mode = "typing";
          schedule(step, delay(typingSpeed));
        }
      }
    };

    state.strIdx = 0;
    state.charIdx = 0;
    state.mode = "typing";
    setDisplayed("");
    step();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [
    linesKey,
    lines.length,
    typingSpeed,
    pauseDuration,
    deletingSpeed,
    variableSpeedEnabled,
    variableSpeedMin,
    variableSpeedMax,
  ]);

  const cursorStyle: CSSProperties | undefined = showCursor
    ? {
        animationName: "text-type-cursor-blink",
        animationDuration: `${cursorBlinkDuration}s`,
        animationTimingFunction: "steps(1, end)",
        animationIterationCount: "infinite",
      }
    : undefined;

  return (
    <span
      className={cn("inline-block whitespace-pre-wrap", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {displayed}
      {showCursor ? (
        <span
          className="inline-block font-mono align-baseline"
          style={cursorStyle}
          aria-hidden
        >
          {cursorCharacter}
        </span>
      ) : null}
    </span>
  );
}
