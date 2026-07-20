import { Brain } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  inverse?: boolean;
};

export function BrandMark({
  className,
  iconClassName,
  wordmarkClassName,
  showWordmark = true,
  inverse = false,
}: BrandMarkProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="NoteHut"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20",
          inverse && "bg-white text-slate-950 shadow-black/10",
          iconClassName,
        )}
        aria-hidden="true"
      >
        <Brain className="size-[1.15rem]" strokeWidth={2.25} />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "text-[1.05rem] font-bold tracking-[-0.025em] text-foreground",
            inverse && "text-white",
            wordmarkClassName,
          )}
        >
          NoteHut
        </span>
      )}
    </span>
  );
}
