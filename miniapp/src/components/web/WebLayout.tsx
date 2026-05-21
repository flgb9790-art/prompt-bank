import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function WebLayout({ sidebar, topbar, children }: Props) {
  return (
    <div className="web-app-shell bg-[var(--bg)] text-[var(--text)]">
      <aside className="web-app-sidebar hidden border-r border-white/10 bg-[var(--sidebar)]/95 lg:block">
        {sidebar}
      </aside>
      <header className="web-app-header z-30 shrink-0 border-b border-white/10 bg-[var(--bg-soft)]/80 backdrop-blur-xl">
        {topbar}
      </header>
      <main className="web-app-main px-4 pb-24 pt-5 lg:px-7 lg:py-7">{children}</main>
    </div>
  );
}
