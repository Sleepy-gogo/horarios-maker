"use client";

import { forwardRef, useId, useState } from "react";
import type { ReactNode } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  /** Leading visual, such as a color swatch. Shown in the trigger and in the list. */
  icon?: ReactNode;
  /** Quiet text after the label in the list only, such as a category. */
  hint?: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps {
  /** Visible label. With hideLabel it only names the control for assistive tech. */
  label: string;
  hideLabel?: boolean;
  description?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  options?: SelectOption[];
  groups?: SelectGroup[];
}

/** The shown value rolls in the direction of the list: a later option rises from below, an earlier one drops from above. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em` }),
  center: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -0.3}em`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }),
};
const valueFade: Variants = { enter: { opacity: 0 }, center: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.instant } }, exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } } };

function Item({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item value={option.value} disabled={option.disabled} className={styles.item}>
      {option.icon ? <span className={styles.icon} aria-hidden="true">{option.icon}</span> : null}
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      {option.hint ? <span className={styles.itemHint} aria-hidden="true">{option.hint}</span> : null}
      <SelectPrimitive.ItemIndicator className={styles.indicator}>
        <Check size={15} strokeWidth={2} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/** A compact choice field with a keyboard friendly list that grows from the trigger. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, hideLabel = false, description, placeholder = "Elegí una opción", options, groups, id, className, disabled, value, onValueChange, size = "md" },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = description ? `${controlId}-description` : undefined;
  const reduceMotion = useReducedMotion();
  const all = groups ? groups.flatMap((group) => group.options) : options ?? [];
  const index = all.findIndex((option) => option.value === value);
  const current = index >= 0 ? all[index] : undefined;
  const [previousIndex, setPreviousIndex] = useState(index);
  const [direction, setDirection] = useState(1);
  if (previousIndex !== index) {
    setPreviousIndex(index);
    setDirection(index > previousIndex ? 1 : -1);
  }

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {hideLabel ? null : <label htmlFor={controlId} className={styles.label}>{label}</label>}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger ref={ref} id={controlId} aria-label={hideLabel ? label : undefined} aria-describedby={hintId} className={styles.trigger} data-size={size}>
          {/* Radix keeps the real value for assistive tech; the visible copy below animates between values. */}
          <span className={styles.srOnly}><SelectPrimitive.Value placeholder={placeholder} /></span>
          <span className={styles.valueText} aria-hidden="true">
            <AnimatePresence initial={false} custom={direction}>
              <motion.span key={current ? `value-${current.value}` : "placeholder"} data-placeholder={current ? undefined : ""} custom={direction} variants={reduceMotion ? valueFade : valueRoll} initial="enter" animate="center" exit="exit">
                {current?.icon ? <span className={styles.icon}>{current.icon}</span> : null}
                <span className={styles.valueLabel}>{current?.label ?? placeholder}</span>
              </motion.span>
            </AnimatePresence>
          </span>
          <SelectPrimitive.Icon className={styles.chevron}>
            <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className={styles.content} position="popper" sideOffset={4} collisionPadding={12}>
            <SelectPrimitive.ScrollUpButton className={styles.scrollButton}>
              <ChevronUp size={15} strokeWidth={1.75} aria-hidden="true" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className={styles.viewport}>
              {groups
                ? groups.map((group, position) => (
                    <SelectPrimitive.Group key={group.label}>
                      {position > 0 ? <SelectPrimitive.Separator className={styles.separator} /> : null}
                      <SelectPrimitive.Label className={styles.groupLabel}>{group.label}</SelectPrimitive.Label>
                      {group.options.map((option) => <Item key={option.value} option={option} />)}
                    </SelectPrimitive.Group>
                  ))
                : all.map((option) => <Item key={option.value} option={option} />)}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className={styles.scrollButton}>
              <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {description ? <span id={hintId} className={styles.hint}>{description}</span> : null}
    </div>
  );
});
