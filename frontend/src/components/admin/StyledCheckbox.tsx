import { Check } from "lucide-react";
import { useId, type ChangeEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

interface StyledCheckboxProps {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

export function StyledCheckbox({
  label,
  className,
  id,
  checked = false,
  disabled = false,
  onChange,
  onBlur,
}: StyledCheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const labelId = `${checkboxId}-label`;

  const handleToggle = () => {
    if (disabled) {
      return;
    }

    onChange?.({
      target: { checked: !checked },
      currentTarget: { checked: !checked },
    } as ChangeEvent<HTMLInputElement>);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      id={checkboxId}
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "border-input bg-background flex size-5 shrink-0 items-center justify-center rounded-md border shadow-xs transition-all",
          checked && "border-primary bg-primary",
        )}
      >
        <Check
          className={cn(
            "text-primary-foreground size-3.5 transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      <span id={labelId} className="text-sm leading-none font-medium">
        {label}
      </span>
    </div>
  );
}
