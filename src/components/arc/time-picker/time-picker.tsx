"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./time-picker.module.css";
export interface TimePickerProps {
    label: string;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    description?: string;
    placeholder?: string;
    minuteStep?: 1 | 5 | 10 | 15 | 30;
    format?: "12h" | "24h";
    /** Enable only on an interval's end field, never on its start. */
    includeEndOfDay?: boolean;
    /** Earliest and latest selectable times, in minutes. Typed times outside them are rejected. */
    min?: number;
    max?: number;
    /** Hides the visible label; it stays the accessible name. */
    hideLabel?: boolean;
    disabled?: boolean;
    className?: string;
}
const pad = (value: number) => String(value).padStart(2, "0");
const toMinutes = (value: string) => { const [h = NaN, m = NaN] = value.split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; };
const fromMinutes = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
/** Reads "9", "930", "0930", "9:30" or "9.30" as minutes. */
function parseTyped(text: string, allowEnd: boolean): number | null {
    const clean = text.replace(/\s/g, "");
    let h: number, m: number;
    const split = /^(\d{1,2})[:.](\d{0,2})$/.exec(clean);
    if (split) {
        h = Number(split[1]);
        m = split[2] ? Number(split[2].length === 1 ? `${split[2]}0` : split[2]) : 0;
    }
    else if (/^\d{1,4}$/.test(clean)) {
        h = Number(clean.length <= 2 ? clean : clean.slice(0, -2));
        m = clean.length <= 2 ? 0 : Number(clean.slice(-2));
    }
    else
        return null;
    if (m > 59)
        return null;
    const total = h * 60 + m;
    if (total === 1440 && allowEnd)
        return total;
    return h > 23 ? null : total;
}
const enter = motionTokens.ease.enter;
const standard = motionTokens.ease.standard;
/** The shown time rolls like a clock face: a later time rises from below, an earlier one drops from above. */
const valueRoll: Variants = {
    enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em` }),
    center: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.standard, ease: enter } },
    exit: (direction: number) => ({ opacity: 0, y: `${direction * -0.3}em`, transition: { duration: motionTokens.duration.fast, ease: standard } }),
};
/** Reduced motion keeps a short crossfade; the resting state matches valueRoll so server and client markup agree. */
const valueFade: Variants = { enter: { opacity: 0 }, center: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.instant } }, exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } } };
/**
 * 24-hour combobox in 30-minute steps. Typing digits while it has focus enters an exact time ("915" is 09:15); Enter applies it.
 * A current value off the step grid (an imported 09:15) is listed so it is never silently rounded.
 */
export function TimePicker({ label, value, defaultValue = "09:00", onChange, description, placeholder = "Elegir hora", minuteStep = 30, format = "24h", includeEndOfDay = false, min = 0, max = 1440, hideLabel = false, disabled = false, className }: TimePickerProps) {
    const id = useId();
    const labelId = `${id}-label`;
    const valueId = `${id}-value`;
    const hintId = `${id}-hint`;
    const rootRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const centerOnOpen = useRef(false);
    const typedTimer = useRef(0);
    const [internal, setInternal] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [typed, setTyped] = useState("");
    const selected = value ?? internal;
    const reduce = useReducedMotion();
    const [previous, setPrevious] = useState(selected);
    const [direction, setDirection] = useState(1);
    if (previous !== selected) {
        setPrevious(selected);
        setDirection(toMinutes(selected) >= toMinutes(previous) ? 1 : -1);
    }
    const minutes = new Set<number>();
    for (let m = 0; m < 1440; m += minuteStep)
        minutes.add(m);
    if (includeEndOfDay)
        minutes.add(1440);
    if (selected)
        minutes.add(toMinutes(selected));
    const options = [...minutes].filter(m => m >= min && m <= max).sort((a, b) => a - b).map(fromMinutes);
    const display = (raw: string) => { const total = toMinutes(raw); const hour = Math.floor(total / 60); const minute = total % 60; return format === "24h" ? `${pad(hour)}:${pad(minute)}` : `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`; };
    const typedValue = typed ? parseTyped(typed, includeEndOfDay) : null;
    const typedValid = typedValue !== null && typedValue >= min && typedValue <= max;
    useEffect(() => { const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node))
        setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
    useEffect(() => () => window.clearTimeout(typedTimer.current), []);
    // Runs before paint so the menu's first frame is already centered on the selected time.
    useLayoutEffect(() => {
        if (!open || activeIndex < 0)
            return;
        // Scroll only the menu, never the page: the selected time opens centered, arrow keys then keep the highlight in view.
        const option = optionRefs.current[activeIndex];
        const menu = option?.parentElement;
        if (!option || !menu)
            return;
        const top = option.offsetTop;
        const bottom = top + option.offsetHeight;
        if (centerOnOpen.current) {
            centerOnOpen.current = false;
            menu.scrollTop = top - (menu.clientHeight - option.offsetHeight) / 2;
        }
        else if (top < menu.scrollTop)
            menu.scrollTop = top;
        else if (bottom > menu.scrollTop + menu.clientHeight)
            menu.scrollTop = bottom - menu.clientHeight;
    }, [activeIndex, open]);
    const choose = (next: string) => { setTyped(""); if (value === undefined)
        setInternal(next); if (next !== selected)
        onChange?.(next); setOpen(false); };
    const openMenu = () => {
        const selectedIndex = options.indexOf(selected);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        centerOnOpen.current = true;
        setOpen(true);
    };
    const type = (next: string) => {
        window.clearTimeout(typedTimer.current);
        setTyped(next);
        if (next)
            typedTimer.current = window.setTimeout(() => setTyped(""), 2500);
        const parsed = parseTyped(next, includeEndOfDay);
        if (parsed !== null) {
            const index = options.findIndex(option => toMinutes(option) >= parsed);
            if (index >= 0)
                setActiveIndex(index);
        }
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (/^[0-9:.]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            type((typed + event.key).slice(0, 5));
            return;
        }
        if (event.key === "Backspace" && typed) {
            event.preventDefault();
            type(typed.slice(0, -1));
            return;
        }
        if (open && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
            return;
        }
        if (event.key === "Escape") {
            if (!open && !typed)
                return;
            event.preventDefault();
            event.stopPropagation();
            setTyped("");
            setOpen(false);
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (typed) {
                if (typedValid)
                    choose(fromMinutes(typedValue!));
                return;
            }
            if (open && activeIndex >= 0)
                choose(options[activeIndex]!);
            else
                openMenu();
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setTyped("");
            if (!open) {
                openMenu();
                return;
            }
            setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        }
    };
    const hint = typed ? (typedValid ? `${display(fromMinutes(typedValue!))} · Enter para aplicar` : typedValue !== null ? "Fuera del rango permitido" : `“${typed}”…`) : null;
    return <div ref={rootRef} className={[styles.field, className].filter(Boolean).join(" ")} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
        setTyped("");
    } }}>
    <span id={labelId} className={hideLabel ? styles.srOnly : styles.label}>{label}</span>
    <div className={styles.anchor}>
      <button type="button" role="combobox" className={styles.trigger} disabled={disabled} aria-labelledby={`${labelId} ${valueId}`} aria-describedby={hint ? hintId : undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-listbox` : undefined} aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={onKeyDown}>
        <Clock3 size={16} aria-hidden="true"/>
        <span id={valueId} className={styles.srOnly}>{selected ? display(selected) : placeholder}</span>
        <span className={styles.valueText} aria-hidden="true"><AnimatePresence initial={false} custom={direction}><motion.span key={typed ? `typed-${typed}` : selected || "placeholder"} className={typed ? styles.typed : selected ? styles.value : styles.placeholder} custom={direction} variants={reduce || typed ? valueFade : valueRoll} initial="enter" animate="center" exit="exit">{typed ? typed : selected ? display(selected) : placeholder}</motion.span></AnimatePresence></span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true"/>
      </button>
      <AnimatePresence initial={false}>{open && <motion.div id={`${id}-listbox`} className={styles.menu} role="listbox" aria-label={`Opciones de ${label}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: motionTokens.duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: enter } } }} exit={{ opacity: 0, ...(reduce ? {} : { y: -4, scale: .98 }), transition: { duration: motionTokens.duration.instant, ease: standard } }}>
        {options.map((option, index) => <button ref={node => { optionRefs.current[index] = node; }} id={`${id}-option-${index}`} type="button" role="option" tabIndex={-1} onPointerDown={event => event.preventDefault()} aria-selected={option === selected} data-active={activeIndex === index || undefined} className={styles.option} key={option} onPointerMove={() => { if (activeIndex !== index)
            setActiveIndex(index); }} onClick={() => choose(option)}>{display(option)}{option === selected && <span className={styles.dot} aria-hidden="true"/>}</button>)}
      </motion.div>}</AnimatePresence>
    </div>
    {hint ? <span id={hintId} className={styles.description} aria-live="polite">{hint}</span> : description ? <span className={styles.description}>{description}</span> : null}
  </div>;
}
