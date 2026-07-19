import { Check } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface StyledCheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: string;
}

export function StyledCheckbox({
  label,
  className,
  id,
  ...props
}: StyledCheckboxProps) {
  const inputId = id ?? props.name;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-center gap-3 select-none",
        className,
      )}
    >
      <input id={inputId} type="checkbox" className="peer sr-only" {...props} />
      <span className="border-input bg-background peer-focus-visible:ring-ring/50 flex size-5 shrink-0 items-center justify-center rounded-md border shadow-xs transition-all peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:[&>svg]:opacity-100">
        <Check className="text-primary-foreground size-3.5 opacity-0 transition-opacity" />
      </span>
      <span className="text-sm leading-none font-medium">{label}</span>
    </label>
  );
}
