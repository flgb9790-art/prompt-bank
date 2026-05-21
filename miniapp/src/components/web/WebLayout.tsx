import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function WebLayout({ sidebar, topbar, children }: Props) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="fixed left-0 top-0 hidden h-screen w-[312px] border-r border-white/10 bg-[var(--sidebar)]/95 lg:block">
        {sidebar}
      </aside>
      <div className="lg:ml-[312px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--bg-soft)]/80 backdrop-blur-xl">
          {topbar}
        </header>
        <main className="px-4 pb-24 pt-5 lg:px-7 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
