import * as React from "react";
import { cn } from "@/lib/utils";

/** Desplegable nativo con el estilo de los campos: rápido con teclado y en el móvil. */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-input bg-campo px-3 text-base text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oliva/30 focus-visible:border-oliva disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-burdeos md:text-sm",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
