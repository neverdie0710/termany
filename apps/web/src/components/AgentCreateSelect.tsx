import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronIcon } from "./icons";

export type AgentCreateChoice = {
  id: string;
  name: string;
  hint?: string;
  icon?: ReactNode;
};

export function AgentCreateSelect({
  label,
  ariaLabel,
  manageLabel,
  manageIcon,
  onManage,
  value,
  choices,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  ariaLabel?: string;
  manageLabel?: string;
  manageIcon?: ReactNode;
  onManage?: () => void;
  value: string;
  choices: AgentCreateChoice[];
  disabled?: boolean;
  placeholder: string;
  onChange: (choice: AgentCreateChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = choices.find((choice) => choice.id === value);
  const selectedIndex = Math.max(0, choices.findIndex((choice) => choice.id === value));

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    const positionMenu = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const edge = 12;
      const gap = 6;
      const desiredHeight = Math.min(304, Math.max(choices.length, 1) * 40 + 10);
      const availableBelow = window.innerHeight - rect.bottom - edge - gap;
      const availableAbove = rect.top - edge - gap;
      const openAbove = availableBelow < Math.min(desiredHeight, 160) && availableAbove > availableBelow;
      const available = openAbove ? availableAbove : availableBelow;
      const maxHeight = Math.max(80, Math.min(desiredHeight, available));
      setMenuPosition({
        left: Math.max(edge, Math.min(rect.left, window.innerWidth - rect.width - edge)),
        top: openAbove ? rect.top - gap - maxHeight : rect.bottom + gap,
        width: Math.min(rect.width, window.innerWidth - edge * 2),
        maxHeight,
      });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [choices.length, open]);

  useEffect(() => {
    if (choices.length === 0) setOpen(false);
    setActiveIndex(selectedIndex);
  }, [choices.length, selectedIndex, value]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, listId, open]);

  return (
    <fieldset className="agent-runtime-fieldset">
      <legend>
        <span className="agent-runtime-legend">
          <span>{label}</span>
          {onManage && (
            <button type="button" className="agent-runtime-manage" onClick={onManage}>
              {manageIcon}
              <span>{manageLabel}</span>
            </button>
          )}
        </span>
      </legend>
      <div className="agent-runtime-select" ref={rootRef} title={selected?.hint}>
        <button
          type="button"
          role="combobox"
          className={`agent-runtime-select-trigger ${open ? "open" : ""}`}
          aria-label={ariaLabel ?? label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
          disabled={disabled || choices.length === 0}
          onClick={() => {
            setActiveIndex(selectedIndex);
            setOpen((current) => !current);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              if (!open) {
                setActiveIndex(selectedIndex >= 0 ? selectedIndex : direction > 0 ? 0 : choices.length - 1);
                setOpen(true);
              } else {
                setActiveIndex((index) => (index + direction + choices.length) % choices.length);
              }
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const choice = choices[activeIndex];
              if (choice) {
                onChange(choice);
                setOpen(false);
              }
            }
          }}
        >
          {selected?.icon ?? <span className="agent-launcher-avatar" />}
          <span>{selected?.name ?? placeholder}</span>
          <ChevronIcon dir="down" />
        </button>
        {open && menuPosition && createPortal(
          <div
            id={`${listId}-listbox`}
            ref={menuRef}
            className="agent-runtime-select-menu"
            role="listbox"
            style={menuPosition}
          >
            {choices.map((choice, index) => {
              const isSelected = choice.id === value;
              return (
                <button
                  id={`${listId}-option-${index}`}
                  key={choice.id || "local"}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`agent-runtime-select-option ${index === activeIndex ? "active" : ""}`}
                  title={choice.hint}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(choice);
                    setOpen(false);
                  }}
                >
                  {choice.icon}
                  <span>{choice.name}</span>
                  <span className="agent-runtime-select-check" aria-hidden="true">
                    {isSelected && <CheckIcon />}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    </fieldset>
  );
}
