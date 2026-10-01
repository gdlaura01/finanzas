import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-campo px-3 py-2 text-base text-tinta placeholder:text-tinta-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oliva/30 focus-visible:border-oliva disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-burdeos md:text-sm",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
