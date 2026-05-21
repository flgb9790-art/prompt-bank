import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function WebLayout({ sidebar, topbar, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <aside className="hidden h-full w-[312px] shrink-0 overflow-y-auto overscroll-y-contain border-r border-white/10 bg-[var(--sidebar)]/95 lg:block">
        {sidebar}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-white/10 bg-[var(--bg-soft)]/80 backdrop-blur-xl">
          {topbar}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-24 pt-5 lg:px-7 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
