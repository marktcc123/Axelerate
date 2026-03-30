"use client";

import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

export const BackgroundGradientAnimation = ({
  gradientBackgroundStart = "rgb(108, 0, 162)",
  gradientBackgroundEnd = "rgb(0, 17, 82)",
  firstColor = "18, 113, 255",
  secondColor = "221, 74, 255",
  thirdColor = "100, 220, 255",
  fourthColor = "200, 50, 50",
  fifthColor = "180, 180, 50",
  pointerColor = "140, 100, 255",
  /** 用 min(vw,vh) 或固定 px，勿单独用 80%（宽高参照轴不同会变成矩形光斑） */
  size = "min(80vw, 80vh)",
  blendingValue = "hard-light",
  children,
  className,
  interactive = true,
  containerClassName,
}: {
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  size?: string;
  blendingValue?: string;
  children?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  containerClassName?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactiveRef = useRef<HTMLDivElement>(null);
  const curXRef = useRef(0);
  const curYRef = useRef(0);
  const rafRef = useRef<number>(0);

  const [tgX, setTgX] = useState(0);
  const [tgY, setTgY] = useState(0);
  const filterId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty("--gradient-background-start", gradientBackgroundStart);
    el.style.setProperty("--gradient-background-end", gradientBackgroundEnd);
    el.style.setProperty("--first-color", firstColor);
    el.style.setProperty("--second-color", secondColor);
    el.style.setProperty("--third-color", thirdColor);
    el.style.setProperty("--fourth-color", fourthColor);
    el.style.setProperty("--fifth-color", fifthColor);
    el.style.setProperty("--pointer-color", pointerColor);
    // 单一尺寸变量：宽高相同，避免 75%×75% 在竖屏上变成「宽扁/高长」矩形光斑
    el.style.setProperty("--size", size);
    el.style.setProperty("--blending-value", blendingValue);
  }, [
    gradientBackgroundStart,
    gradientBackgroundEnd,
    firstColor,
    secondColor,
    thirdColor,
    fourthColor,
    fifthColor,
    pointerColor,
    size,
    blendingValue,
  ]);

  useEffect(() => {
    if (!interactive) return;
    const tick = () => {
      const curX = curXRef.current;
      const curY = curYRef.current;
      curXRef.current = curX + (tgX - curX) / 20;
      curYRef.current = curY + (tgY - curY) / 20;
      if (interactiveRef.current) {
        interactiveRef.current.style.transform = `translate(${Math.round(
          curXRef.current
        )}px, ${Math.round(curYRef.current)}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tgX, tgY, interactive]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTgX(event.clientX - rect.left);
    setTgY(event.clientY - rect.top);
  };

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={interactive ? handleMouseMove : undefined}
      className={cn(
        "relative left-0 top-0 h-full min-h-dvh w-full overflow-hidden bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))]",
        containerClassName
      )}
    >
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id={`blurMe-${filterId}`}>
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      {/* 与原版 prompt 一致：Safari 仅用 blur-2xl；Chromium 仅用 SVG goo + blur(40px)，勿叠 blur-lg 以免出现方形硬边 */}
      <div
        className={cn(
          "gradients-container pointer-events-none absolute inset-0 z-0 h-full w-full",
          isSafari && "blur-2xl"
        )}
        style={
          !isSafari
            ? { filter: `url(#blurMe-${filterId}) blur(40px)` }
            : undefined
        }
      >
        {/* 每层均为「正方形 + 正圆裁剪 + 径向渐变」，保证光斑为圆形后再经 goo 融合 */}
        <div
          className={cn(
            "absolute left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)] aspect-square size-[var(--size)] rounded-full",
            "[background:radial-gradient(circle_at_center,_rgb(var(--first-color))_0,_rgb(var(--first-color))_50%)_no-repeat]",
            "[mix-blend-mode:var(--blending-value)] [transform-origin:center_center]",
            "animate-first",
            "opacity-100"
          )}
        />
        <div
          className={cn(
            "absolute left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)] aspect-square size-[var(--size)] rounded-full",
            "[background:radial-gradient(circle_at_center,_rgba(var(--second-color),_0.8)_0,_rgba(var(--second-color),_0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--blending-value)] [transform-origin:calc(50%-400px)]",
            "animate-second",
            "opacity-100"
          )}
        />
        <div
          className={cn(
            "absolute left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)] aspect-square size-[var(--size)] rounded-full",
            "[background:radial-gradient(circle_at_center,_rgba(var(--third-color),_0.8)_0,_rgba(var(--third-color),_0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--blending-value)] [transform-origin:calc(50%+400px)]",
            "animate-third",
            "opacity-100"
          )}
        />
        <div
          className={cn(
            "absolute left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)] aspect-square size-[var(--size)] rounded-full",
            "[background:radial-gradient(circle_at_center,_rgba(var(--fourth-color),_0.8)_0,_rgba(var(--fourth-color),_0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--blending-value)] [transform-origin:calc(50%-200px)]",
            "animate-fourth",
            "opacity-70"
          )}
        />
        <div
          className={cn(
            "absolute left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)] aspect-square size-[var(--size)] rounded-full",
            "[background:radial-gradient(circle_at_center,_rgba(var(--fifth-color),_0.8)_0,_rgba(var(--fifth-color),_0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--blending-value)] [transform-origin:calc(50%-800px)_calc(50%+800px)]",
            "animate-fifth",
            "opacity-100"
          )}
        />

        {interactive && (
          <div
            ref={interactiveRef}
            className={cn(
              "absolute -left-1/2 -top-1/2 h-[200%] w-[200%] rounded-full",
              "[background:radial-gradient(circle_at_center,_rgba(var(--pointer-color),_0.8)_0,_rgba(var(--pointer-color),_0)_45%)_no-repeat]",
              "[mix-blend-mode:var(--blending-value)]",
              "opacity-70"
            )}
          />
        )}
      </div>
      <div className={cn("relative z-10 min-h-dvh", className)}>{children}</div>
    </div>
  );
};
