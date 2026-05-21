import type { Prompt } from "../types";
import { PromptCard } from "../components/PromptCard";

type Props = {
  prompts: Prompt[];
  stats: { total: number; favorites: number; categories: number; usage: number };
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onCreate: () => void;
};

export function HomePage({ prompts, stats, onOpenPrompt, onCopyPrompt, onToggleFavorite, onCreate }: Props) {
  return (
    <div className="space-y-4 pb-2">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary-2 to-blue text-lg font-semibold shadow-glow">P</div>
        <div>
          <h1 className="text-[30px] leading-none font-semibold tracking-tight">Prompt Bank</h1>
          <p className="mt-1 text-sm text-muted">Добро пожаловать! 👋</p>
        </div>
      </header>

      <section className="glass-card p-4">
        <p className="text-sm leading-relaxed text-slate-300">Здесь хранятся все ваши промпты. Легко находите, копируйте и улучшайте.</p>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <StatCard label="Всего промптов" value={stats.total} />
        <StatCard label="Избранных" value={stats.favorites} />
        <StatCard label="Категорий" value={stats.categories} />
        <StatCard label="Использований" value={stats.usage} />
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-slate-200">Недавние промпты</h2>
        {prompts.length ? (
          <div className="space-y-2.5">
            {prompts.slice(0, 5).map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} onOpen={onOpenPrompt} onCopy={onCopyPrompt} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        ) : (
          <div className="glass-card empty-state">
            <p className="text-base font-medium text-slate-100">Пока нет промптов</p>
            <p className="mt-1 text-sm text-muted">Создайте первый промпт кнопкой ниже.</p>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onCreate}
        className="cta-button w-full px-4 py-4 text-base font-semibold"
      >
        ➕ Новый промпт
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card p-3.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
