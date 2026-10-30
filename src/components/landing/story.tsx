"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  createAgentField,
  type AgentField,
  type FieldCopy,
  type PhaseId,
} from "./agent-field";

export interface StoryStep {
  id: PhaseId;
  label: string;
  content: ReactNode;
}

// Phase-based scroll story. One sticky full-viewport stage holds the agent
// field, the copy panels and the progress rail; a column of invisible
// 100svh markers underneath drives which phase is active. Native scrolling
// stays intact (proximity snap lives in globals.css), so trackpads, find-in-
// page and the footer all keep working. Arrow keys / Space step one phase.
export function Story({
  steps,
  copy,
}: {
  steps: StoryStep[];
  copy: FieldCopy;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fieldRef = useRef<AgentField | null>(null);
  const activeRef = useRef(0);
  const pendingRef = useRef<{ index: number; at: number } | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const field = createAgentField(canvas, { reducedMotion, copy });
    fieldRef.current = field;
    field.setPhase(steps[activeRef.current].id);
    canvas.dataset.ready = "true";

    const resize = new ResizeObserver(() => field.resize());
    resize.observe(canvas);
    // Only animate while the stage is on screen.
    const onScreen = new IntersectionObserver(([entry]) =>
      field.setRunning(entry.isIntersecting),
    );
    onScreen.observe(root);
    return () => {
      resize.disconnect();
      onScreen.disconnect();
      field.destroy();
      fieldRef.current = null;
    };
  }, [copy, steps]);

  useEffect(() => {
    fieldRef.current?.setPhase(steps[active].id);
  }, [active, steps]);

  // The marker crossing the viewport's horizontal midline is the active phase.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.storyStep);
          activeRef.current = index;
          setActive(index);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const el of markerRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [steps.length]);

  const goTo = useCallback((index: number) => {
    const marker = markerRefs.current[index];
    if (!marker) return;
    pendingRef.current = { index, at: performance.now() };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: marker.getBoundingClientRect().top + window.scrollY,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
      const space = e.key === " ";
      // Space on a focused control should press it, not scroll.
      if (space && el && /^(BUTTON|A|SUMMARY)$/.test(el.tagName)) return;

      let dir = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown" || (space && !e.shiftKey)) dir = 1;
      if (e.key === "ArrowUp" || e.key === "PageUp" || (space && e.shiftKey)) dir = -1;
      if (dir === 0) return;

      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      // Only while the stage is pinned; elsewhere the page scrolls natively.
      if (rect.top > 1 || rect.bottom < window.innerHeight - 1) return;

      // A smooth scroll is still travelling: step from where it is headed.
      const pending = pendingRef.current;
      const from =
        pending && performance.now() - pending.at < 900
          ? pending.index
          : activeRef.current;
      const next = from + dir;
      if (next < 0 || next >= steps.length) return;
      e.preventDefault();
      goTo(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, steps.length]);

  const flagged = steps.findIndex((s) => s.id === "wallet");

  return (
    <div
      ref={rootRef}
      data-story
      className="relative -mt-14"
      style={{ height: `calc(${steps.length} * 100svh)` }}
    >
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 size-full opacity-0 transition-opacity duration-700 ease-out data-[ready=true]:opacity-100"
        />
        {/* Scrim keeps the copy legible where it overlaps the field. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-linear-to-t from-background via-background/85 to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-[58%] lg:bg-linear-to-r"
        />

        <div className="relative mx-auto grid h-full w-full max-w-[1200px] items-end px-6 pb-10 pt-28 lg:items-center lg:px-8 lg:pb-0 lg:pt-14">
          <div className="grid max-w-[540px] [grid-template-areas:'stack']">
            {steps.map((step, i) => (
              <section
                key={step.id}
                data-active={i === active ? "" : undefined}
                data-side={i < active ? "before" : "after"}
                inert={i !== active}
                aria-hidden={i !== active}
                className="story-panel flex max-h-[calc(100dvh-9rem)] flex-col gap-5 self-end overflow-y-auto [grid-area:stack] lg:max-h-none lg:self-center lg:overflow-visible"
              >
                {step.content}
              </section>
            ))}
          </div>
        </div>

        <Rail steps={steps} active={active} onSelect={goTo} />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[4.5rem] lg:bottom-8 lg:top-auto"
        >
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-6 lg:px-8">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-foreground" />
                agent
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-px w-3 bg-lightning" />
                sats on lightning
              </li>
              <li
                className={cn(
                  "flex items-center gap-1.5 transition-opacity duration-500",
                  active >= flagged ? "opacity-100" : "opacity-0",
                )}
              >
                <span className="size-2 rounded-full border border-foreground" />
                abusive wallet
              </li>
            </ul>
            <div className="hidden lg:block">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground pointer-coarse:hidden">
                <kbd className="rounded-sm border border-border px-1 leading-4">↑</kbd>
                <kbd className="rounded-sm border border-border px-1 leading-4">↓</kbd>
                <span className="pl-1">to navigate</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col">
        {steps.map((step, i) => (
          <div
            key={step.id}
            ref={(el) => {
              markerRefs.current[i] = el;
            }}
            data-story-step={i}
            className="h-[100svh] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

function Rail({
  steps,
  active,
  onSelect,
}: {
  steps: StoryStep[];
  active: number;
  onSelect: (index: number) => void;
}) {
  const progress = steps.length > 1 ? active / (steps.length - 1) : 0;
  return (
    // The line with the current phase named beside it; hovering or focusing
    // the rail reveals every phase name so it doubles as a map.
    <nav
      aria-label="Story sections"
      className="group/rail absolute right-2 top-28 lg:right-6 lg:top-1/2 lg:-translate-y-1/2"
    >
      <ol className="relative flex h-[184px] flex-col justify-between lg:h-56">
        {/* A single line. The track overshoots the first and last phase so
            every label sits beside it, never perched on an end. The fill
            steps per phase, or tracks scroll continuously where scroll-driven
            animations exist (globals.css). */}
        <span
          aria-hidden
          className="absolute -bottom-2 -top-2 right-[11px] w-px bg-border"
        />
        <span
          aria-hidden
          data-story-fill
          className="absolute right-[11px] top-3 h-[calc(100%-1.5rem)] w-px origin-top bg-foreground transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ transform: `scaleY(${progress})` }}
        />
        {steps.map((step, i) => {
          const current = i === active;
          return (
            <li key={step.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                aria-label={step.label}
                className="group flex h-6 w-full items-center justify-end rounded-sm pl-2 pr-[22px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "hidden font-mono text-[11px] transition-[opacity,transform,color] duration-150 ease-out lg:block",
                    current
                      ? "translate-x-0 text-foreground opacity-100"
                      : "translate-x-1 text-muted-foreground opacity-0 group-hover:text-foreground group-focus-visible:text-foreground group-hover/rail:translate-x-0 group-hover/rail:opacity-100 group-focus-within/rail:translate-x-0 group-focus-within/rail:opacity-100",
                  )}
                  style={{ transitionDelay: `${i * 25}ms` }}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
