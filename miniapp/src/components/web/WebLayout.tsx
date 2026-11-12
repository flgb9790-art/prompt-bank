import type { ReactNode } from "react";
type Props = { topbar: ReactNode; children: ReactNode };
export function WebLayout({ topbar, children }: Props) {
  return <div className="studio-shell"><header className="studio-header">{topbar}</header><main className="web-app-main prompt-scroll-root">{children}</main></div>;
}
