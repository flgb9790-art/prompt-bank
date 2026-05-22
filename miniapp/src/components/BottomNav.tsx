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
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={`bottom-nav-item ${active ? "active" : ""}`}>
              <Icon size={24} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
