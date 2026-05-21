import { House, LayoutGrid, Search, Star, User } from "lucide-react";

export type TabKey = "home" | "prompts" | "search" | "favorites" | "profile" | "add";

type Props = {
  current: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: Array<{ key: TabKey; label: string; icon: typeof House }> = [
  { key: "home", label: "Главная", icon: House },
  { key: "prompts", label: "Промпты", icon: LayoutGrid },
  { key: "search", label: "Поиск", icon: Search },
  { key: "favorites", label: "Избранное", icon: Star },
  { key: "profile", label: "Профиль", icon: User }
];

export function BottomNav({ current, onChange }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-3">
      <div className="w-full max-w-[480px] rounded-3xl border border-white/10 bg-[#090f22]/92 p-2 shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = current === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                className={`flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] transition ${
                  active
                    ? "bg-gradient-to-b from-primary/35 to-primary/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-muted hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                <span className="mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
