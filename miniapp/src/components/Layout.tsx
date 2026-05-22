import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  freezeScroll?: boolean;
};

export function Layout({ children, freezeScroll = false }: Props) {
  return (
    <div className="app-shell">
      <div className={`mobile-frame ${freezeScroll ? "sheet-collapsed" : ""}`}>{children}</div>
    </div>
  );
}
