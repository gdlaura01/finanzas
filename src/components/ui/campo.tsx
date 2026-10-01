import { cn } from "@/lib/utils";
import { Label } from "./label";

/** Etiqueta + control + error, con los ids enlazados para lectores de pantalla. */
export function Campo({ id, etiqueta, error, ayuda, className, children }: { id: string; etiqueta: React.ReactNode; error?: string; ayuda?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-burdeos">
          {error}
        </p>
      ) : ayuda ? (
        <div className="text-xs text-tinta-3">{ayuda}</div>
      ) : null}
    </div>
  );
}
