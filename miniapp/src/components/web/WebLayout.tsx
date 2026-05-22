import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
};

export function WebLayout({ sidebar, topbar, children, sidebarOpen = false, onSidebarClose }: Props) {
  return (
    <div className="web-app-shell">
      {sidebarOpen ? (
        <button type="button" className="web-app-sidebar-overlay lg:hidden" onClick={onSidebarClose} aria-label="Закрыть меню" />
      ) : null}
      <aside className={`web-app-sidebar hidden h-full min-h-0 lg:block ${sidebarOpen ? "open !block" : ""}`}>{sidebar}</aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="web-app-header z-30 shrink-0">{topbar}</header>
        <main className="web-app-main">{children}</main>
      </div>
    </div>
  );
}
