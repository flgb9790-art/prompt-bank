import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function MobilePromptFeed({ children, className = "" }: Props) {
  return <div className={`mobile-prompt-feed ${className}`.trim()}>{children}</div>;
}
