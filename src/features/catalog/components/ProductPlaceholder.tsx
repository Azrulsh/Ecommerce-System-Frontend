import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50/70",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <ImageOff size={36} strokeWidth={1} aria-hidden="true" />
        <span className="text-xs">Image unavailable</span>
      </div>
    </div>
  );
}
