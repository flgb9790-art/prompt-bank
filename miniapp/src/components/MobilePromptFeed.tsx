import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  paginated?: boolean;
};

export function MobilePromptFeed({ children, className = "", paginated = false }: Props) {
  return (
    <div className={`mobile-prompt-feed ${paginated ? "mobile-prompt-feed--paginated" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
