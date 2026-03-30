"use client";

import { useMemo } from "react";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { schoolToConfig } from "@/lib/constants/schools";
import {
  FAR_CLIPS,
  getSkylineConfig,
  WIN_COLORS,
  type SkylineBuilding,
} from "@/lib/constants/school-skyline";

/**  seeded RNG for deterministic window positions */
function mkRng(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function SchoolSkyline() {
  const { campusSchool, themeSchool } = useAppDataContext();
  const school = campusSchool ?? themeSchool;
  const config = schoolToConfig(school);
  const skyline = getSkylineConfig(config.shortName, config.primaryColor);

  const buildingsWithWindows = useMemo(() => {
    const rng = mkRng(42);
    return skyline.buildings.map((b, i) => {
      const winCount = b.winCount ?? 3;
      const wins = Array.from({ length: winCount }).map(() => ({
        x: 8 + rng() * 80,
        y: 12 + rng() * 65,
        col: WIN_COLORS[Math.floor(rng() * WIN_COLORS.length)],
        size: rng() > 0.6 ? 2 : 1.5,
      }));
      return { ...b, wins };
    });
  }, [skyline.buildings]);

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 h-24 overflow-hidden"
      aria-hidden
    >
      {/* 渐变遮罩：与主背景融合 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(4,4,8,0.95) 0%, rgba(4,4,8,0.6) 40%, transparent 100%)",
        }}
      />
      {/* 天际线建筑 */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-0.5 px-2"
        style={{ height: 96 }}
      >
        {buildingsWithWindows.map((bldg, i) => {
          const { shape, h, w, hasNeon, wins } = bldg;
          const clipPath = FAR_CLIPS[shape];
          const neonC = skyline.neonColor;
          return (
            <div
              key={i}
              className="relative flex-shrink-0"
              style={{ height: h, width: w }}
            >
              <div
                className="absolute inset-0"
                style={{ clipPath: clipPath }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, #0e0e24 0%, #050512 100%)",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 8px)",
                  }}
                />
                {hasNeon && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                      background: neonC,
                      opacity: 0.9,
                      boxShadow: `0 0 6px ${neonC}`,
                    }}
                  />
                )}
                {wins.map((win, j) => (
                  <div
                    key={j}
                    className="absolute rounded-sm"
                    style={{
                      left: `${win.x}%`,
                      top: `${win.y}%`,
                      width: win.size,
                      height: win.size,
                      backgroundColor: win.col,
                      boxShadow: `0 0 ${win.size + 2}px ${win.col}99`,
                    }}
                  />
                ))}
              </div>
              {hasNeon && (
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: -6,
                    height: 12,
                    background: `radial-gradient(ellipse at center, ${neonC}55 0%, transparent 70%)`,
                    filter: "blur(4px)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
