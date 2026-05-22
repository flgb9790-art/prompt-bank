import type { ReactNode } from "react";
import { BarChart3, Heart, Layers, Sparkles } from "lucide-react";
import type { Prompt } from "../types";
import { PromptCard } from "../components/PromptCard";

type Props = {
  prompts: Prompt[];
  stats: { total: number; favorites: number; categories: number; usage: number };
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onTagClick?: (tag: string) => void;
  onCreate?: () => void;
  onViewAll?: () => void;
  showCreateButton?: boolean;
};

export function HomePage({ prompts, stats, onOpenPrompt, onCopyPrompt, onToggleFavorite, onTagClick, onCreate, onViewAll, showCreateButton = true }: Props) {
  return (
    <div className="space-y-4 pb-4">
      <section>
        <h1 className="mobile-welcome-title">Добро пожаловать! 👋</h1>
        <p className="welcome-subtitle">Здесь хранятся все ваши промпты. Легко находите, копируйте и улучшайте.</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MobileStat icon={<Layers size={20} />} label="Всего промптов" value={stats.total} iconBg="bg-[var(--primary-soft)] text-[var(--primary)]" />
        <MobileStat icon={<Heart size={20} />} label="Избранных" value={stats.favorites} iconBg="bg-[#fdf2f8] text-pink-600" />
        <MobileStat icon={<Sparkles size={20} />} label="Категорий" value={stats.categories} iconBg="bg-[var(--blue-soft)] text-[var(--blue)]" />
        <MobileStat icon={<BarChart3 size={20} />} label="Использований" value={stats.usage} iconBg="bg-[var(--purple-soft)] text-[var(--purple)]" />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="mobile-section-title">Недавние промпты</h2>
          {onViewAll ? (
            <button type="button" className="link-primary" onClick={onViewAll}>
              Все
            </button>
          ) : null}
        </div>
        {prompts.length ? (
          <div className="mt-4 flex flex-col gap-3">
            {prompts.slice(0, 8).map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} variant="mobile" onOpen={onOpenPrompt} onCopy={onCopyPrompt} onToggleFavorite={onToggleFavorite} onTagClick={onTagClick} />
            ))}
          </div>
        ) : (
          <div className="surface-card empty-state mt-4">
            <p className="text-base font-medium text-[var(--text)]">Пока нет промптов</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый промпт кнопкой ниже.</p>
          </div>
        )}
      </section>

      {showCreateButton && onCreate ? (
        <button type="button" onClick={onCreate} className="cta-button">
          ➕ Новый промпт
        </button>
      ) : null}
    </div>
  );
}

function MobileStat({
  icon,
  label,
  value,
  iconBg
}: {
  icon: ReactNode;
  label: string;
  value: number;
  iconBg: string;
}) {
  return (
    <div className="stat-card-mobile">
      <div className={`stat-icon-mobile ${iconBg}`}>{icon}</div>
      <div>
        <p className="stat-value-mobile">{value}</p>
        <p className="stat-label-mobile">{label}</p>
      </div>
    </div>
  );
}
