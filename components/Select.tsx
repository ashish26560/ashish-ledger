"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Accessible name — required, since these rarely have a visible <label>. */
  label: string;
  /** Extra classes for the trigger button. */
  className?: string;
  disabled?: boolean;
  /** Shown when `value` matches no option (e.g. nothing chosen yet). */
  placeholder?: string;
  /** Right-align the popup with the trigger instead of left. */
  align?: "left" | "right";
}

const POPUP_MAX_HEIGHT = 280;
const POPUP_MIN_WIDTH = 168;
const VIEWPORT_MARGIN = 8;

interface PopupPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * A styled replacement for `<select>`.
 *
 * Two reasons it exists rather than a restyled native control:
 *
 * 1. Native selects can't be sized consistently across platforms, and iOS
 *    Safari zooms the page whenever a form control's font-size is under 16px
 *    — which forced every dropdown in the app to render oversized. A button
 *    isn't a form control, so it's exempt and can use the app's own type
 *    scale.
 * 2. The popup renders in a portal on `document.body` with fixed positioning,
 *    so it can't be clipped by the `overflow-hidden`/`overflow-auto` wrappers
 *    around the transactions table and the import preview.
 *
 * Keyboard support mirrors the native control: Enter/Space/Arrow to open,
 * arrows and Home/End to move, Enter/Space to commit, Escape to cancel, and
 * type-ahead to jump by first letters. Focus stays on the trigger and the
 * active option is advertised via `aria-activedescendant`.
 */
export default function Select({
  value,
  onChange,
  options,
  label,
  className = "",
  disabled = false,
  placeholder = "Select…",
  align = "left",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });

  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : placeholder;

  // Portals need a DOM; this component also renders on the server.
  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const above = rect.top - VIEWPORT_MARGIN;
    // Prefer dropping downward, but flip up when there's meaningfully more
    // room there — otherwise a control near the bottom of a phone screen
    // gets a two-item-tall list.
    const dropUp = below < Math.min(POPUP_MAX_HEIGHT, above) && above > below;
    const maxHeight = Math.min(POPUP_MAX_HEIGHT, dropUp ? above : below);
    const width = Math.max(rect.width, POPUP_MIN_WIDTH);

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), window.innerWidth - width - VIEWPORT_MARGIN);

    setPosition({
      top: dropUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left,
      width,
      maxHeight,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // `true` for capture so scrolling of any ancestor container repositions
    // the popup, not just the window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Close when the pointer goes down anywhere outside the trigger or popup.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option in view as the user arrows through.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)?.scrollIntoView({ block: "nearest" });
    // optionId is derived from listboxId, which is stable for this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveTo(index: number) {
    if (options.length === 0) return;
    setActiveIndex(((index % options.length) + options.length) % options.length);
  }

  function handleTypeahead(key: string) {
    const now = Date.now();
    const state = typeahead.current;
    // Successive keystrokes within a beat build up a search string, so typing
    // "sub" lands on Subscriptions rather than cycling S-U-B.
    state.query = now - state.at < 700 ? state.query + key : key;
    state.at = now;
    const match = options.findIndex((o) => o.label.toLowerCase().startsWith(state.query.toLowerCase()));
    if (match >= 0) {
      if (open) setActiveIndex(match);
      else onChange(options[match].value);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
        return;
      }
    } else {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setOpen(false);
          return;
        case "Enter":
        case " ":
          event.preventDefault();
          commit(activeIndex);
          return;
        case "ArrowDown":
          event.preventDefault();
          moveTo(activeIndex + 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveTo(activeIndex - 1);
          return;
        case "Home":
          event.preventDefault();
          moveTo(0);
          return;
        case "End":
          event.preventDefault();
          moveTo(options.length - 1);
          return;
        case "Tab":
          setOpen(false);
          return;
      }
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      handleTypeahead(event.key);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 bg-paper border border-line rounded px-2 py-1.5 text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate min-w-0">{selectedLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {mounted &&
        open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-[60] overflow-y-auto overscroll-contain bg-paper border border-ink rounded shadow-lg py-1"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                    isActive ? "bg-paperDim" : ""
                  } ${isSelected ? "text-forestDeep font-medium" : "text-ink"}`}
                >
                  <span className="w-3 shrink-0 text-forestDeep">{isSelected ? "✓" : ""}</span>
                  <span className="min-w-0 break-words">{option.label}</span>
                </li>
              );
            })}
            {options.length === 0 && <li className="px-3 py-2 text-sm text-muted italic">No options</li>}
          </ul>,
          document.body
        )}
    </>
  );
}
