import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  api,
  confirmPinterestPublication,
  resolveMediaUrl,
  resolveCardMediaUrl,
  type PinterestStatus,
} from "../api";
import type {
  IdeaStudioDraft,
  IdeaStudioOverview,
  IdeaStudioSettings,
} from "../ideaStudioTypes";
import { useDialogFocus } from "../hooks/useDialogFocus";
import {
  StudioCreativeProfile,
  StudioReferencePreview,
  themeOptions,
} from "../components/studio/StudioCreativeProfile";
import "../idea-studio.css";

const statuses: Record<string, string> = {
  queued: "В очереди",
  generating: "Готовим тексты",
  images: "Рисуем изображения",
  ready: "Готово к просмотру",
  partial: "Есть незавершённые изображения",
  failed: "Нужна проверка",
};
const jobNames: Record<string, string> = {
  generate: "Подборка",
  image: "Изображение",
  rewrite: "Переработка",
  publish: "Публикация в Telegram",
};
type Filter = "new" | "selected" | "published" | "rejected";
function StudioDialog({
  title,
  onClose,
  busy,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(
    ref,
    true,
    () => {
      if (!busy) onClose();
    },
    Boolean(busy),
  );
  return (
    <div className="idea-dialog-overlay">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-dialog-title"
        tabIndex={-1}
        className={`idea-dialog${wide ? " idea-dialog--wide" : ""}`}
      >
        <header>
          <h2 id="idea-dialog-title">{title}</h2>
          <button
            type="button"
            className="studio-icon"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
function IdeaImage({
  draft,
  full = false,
}: {
  draft: IdeaStudioDraft;
  full?: boolean;
}) {
  const [fallback, setFallback] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setFallback(false);
    setFailed(false);
  }, [draft.imageUrl]);
  return draft.imageUrl && !failed ? (
    <img
      src={
        full || fallback
          ? resolveMediaUrl(draft.imageUrl)
          : resolveCardMediaUrl(draft.imageUrl, "image")
      }
      alt={draft.title}
      loading={full ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        if (!full && !fallback) setFallback(true);
        else setFailed(true);
      }}
    />
  ) : (
    <div
      className={`idea-image-placeholder${draft.imageStatus === "generating" ? " is-generating" : ""}`}
    >
      {draft.imageStatus === "generating" ? (
        <Loader2 className="idea-spin" size={26} />
      ) : (
        <ImagePlus size={28} strokeWidth={1.3} />
      )}
      <span>
        {failed
          ? "Не удалось загрузить изображение"
          : draft.imageStatus === "generating"
            ? "Создаём изображение"
            : draft.imageStatus === "failed"
              ? "Изображение не готово"
              : "Изображение в очереди"}
      </span>
    </div>
  );
}
export function IdeaStudioPage({
  onBack,
  onOpenSettings,
}: {
  onBack?: () => void;
  onOpenSettings?: () => void;
}) {
  const [data, setData] = useState<IdeaStudioOverview>();
  const [settings, setSettings] = useState<IdeaStudioSettings>();
  const [batchId, setBatchId] = useState<string>();
  const [filter, setFilter] = useState<Filter>("new");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcePrompt, setSourcePrompt] = useState(""),
    [mode, setMode] = useState<"new" | "rewrite">("new");
  const [confirmation, setConfirmation] = useState<
    "generate" | "publish" | null
  >(null);
  const [editor, setEditor] = useState<IdeaStudioDraft>(),
    [rewrite, setRewrite] = useState("");
  const [pinterest, setPinterest] = useState<PinterestStatus>();
  const serial = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++serial.current;
    const next = await api.ideaStudio(batchId);
    if (id !== serial.current) return;
    setData(next);
    setSettings((current) => current || next.settings);
  }, [batchId]);
  useEffect(() => {
    let active = true;
    void refresh().catch((err) => {
      if (active) setError(err.message);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => undefined);
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
      serial.current++;
    };
  }, [refresh]);
  useEffect(() => {
    void api
      .pinterestStatus()
      .then(setPinterest)
      .catch(() => undefined);
  }, []);
  async function run(action: () => Promise<void>, message = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      if (message) setNotice(message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  }
  const drafts = data?.current?.drafts || [];
  const batchContext = data?.current?.creativeContext;
  const unpublished = (d: IdeaStudioDraft) => !d.prompt?.telegramPostUrl;
  const selected = drafts.filter(
    (d) => d.selected && !d.rejected && unpublished(d),
  );
  const ready = (d: IdeaStudioDraft) =>
    Boolean(
      d.imageUrl &&
        d.imageStatus === "ready" &&
        !d.imageStale &&
        !d.busyJobId &&
        !d.publishUncertain,
    );
  const canPublish = selected.length > 0 && selected.every(ready);
  const visible = drafts.filter((d) =>
    filter === "published"
      ? !unpublished(d)
      : filter === "rejected"
        ? d.rejected
        : filter === "selected"
          ? d.selected && !d.rejected && unpublished(d)
          : !d.rejected && unpublished(d),
  );
  const activeJobs =
    data?.jobs.filter((j) => j.status === "queued" || j.status === "running") ||
    [];
  async function generate() {
    if (!settings) return;
    await run(async () => {
      const result = await api.generateIdeaBatch({
        count: settings.dailyCount,
        topics: settings.topics,
        language: settings.language,
        useWebSearch: settings.useWebSearch,
        sourcePrompt: mode === "rewrite" ? sourcePrompt : undefined,
        creativeProfile: settings.creativeProfile,
      });
      setBatchId(result.batchId);
      setGeneratorOpen(false);
      setConfirmation(null);
      setFilter("new");
    }, "Подборка поставлена в очередь. Можно закрыть страницу — работа продолжится на сервере.");
  }
  async function saveEditor() {
    if (!editor) return;
    await run(async () => {
      await api.editIdeaDraft(editor.id, {
        title: editor.title,
        concept: editor.concept,
        content: editor.content,
        imagePrompt: editor.imagePrompt,
      });
      setEditor(undefined);
    }, "Черновик сохранён. После изменения промпта создайте новое изображение перед публикацией.");
  }
  async function publishPin(draft: IdeaStudioDraft) {
    await run(async () => {
      if (!draft.promptId || !draft.prompt?.telegramPostUrl)
        throw new Error("Сначала нужна успешная публикация в Telegram.");
      const prompt = await api.getPrompt(draft.promptId, true);
      const confirmation = await confirmPinterestPublication(prompt);
      if (!confirmation) return;
      const result = await api.publishPromptToPinterest(
        prompt.id,
        draft.prompt.telegramPostUrl,
        confirmation,
      );
      if (result.status !== "published")
        throw new Error(result.error || "Pinterest не подтвердил публикацию.");
    });
  }
  if (!data || !settings)
    return (
      <section className="idea-studio">
        <div className="idea-empty">
          <Sparkles size={30} />
          <h1>Студия идей</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button
                className="btn-secondary"
                onClick={() => void run(refresh)}
              >
                Повторить
              </button>
            </>
          ) : (
            <p>Открываем рабочее пространство…</p>
          )}
        </div>
      </section>
    );
  return (
    <section className="idea-studio">
      {onBack && (
        <button className="idea-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Назад
        </button>
      )}
      <header className="idea-page-header">
        <div>
          <p className="idea-eyebrow">
            <Sparkles size={14} />
            ТВОЯ ТВОРЧЕСКАЯ СТУДИЯ
          </p>
          <h1>Идеи, которые хочется создать.</h1>
          <p>Собери подборку. Выбери лучшее. Поделись.</p>
        </div>
        <div className="idea-header-actions">
          <button
            className={`studio-icon ${settingsOpen ? "selected" : ""}`}
            title="Настройки генерации"
            aria-label="Настройки генерации"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings2 size={19} />
          </button>
          <button
            className="btn-primary"
            onClick={() => setGeneratorOpen(!generatorOpen)}
          >
            <Sparkles size={16} />
            Новая подборка
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="idea-message is-error">
          {error}
          <button
            className="studio-icon"
            aria-label="Закрыть сообщение"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="idea-message">
          {notice}
        </p>
      )}
      {!data.configured && (
        <div className="idea-message">
          <div>
            <strong>Подключи OpenAI, чтобы начать</strong>
            <p>
              Добавь OPENAI_API_KEY в переменные backend Railway. Ключ не
              вводится на сайте и не отправляется в браузер.
            </p>
          </div>
        </div>
      )}

      <StudioCreativeProfile
        value={settings.creativeProfile}
        onChange={(creativeProfile) =>
          setSettings({ ...settings, creativeProfile })
        }
        reference={data.reference}
        busy={busy}
        onUpload={(file) => {
          if (file.size > 10 * 1024 * 1024) {
            setError("Фото должно быть не больше 10 МБ.");
            return;
          }
          void run(async () => {
            await api.uploadIdeaReference(file);
          }, "Фото персонажа сохранено. Новые подборки будут использовать этот референс.");
        }}
        onRemove={() =>
          void run(async () => {
            await api.removeIdeaReference();
          }, "Фото убрано из профиля. Старые подборки сохраняют свой референс.")
        }
        onSave={() =>
          void run(async () => {
            await api.saveIdeaStudioSettings(settings);
          }, "Персонаж и тематики сохранены для следующих подборок.")
        }
      />
      {(generatorOpen || !data.current) && (
        <section className="idea-panel idea-generator">
          <div className="idea-panel-heading">
            <div>
              <h2>С чего начнём?</h2>
              <p>Каждая идея получит готовый промпт и своё изображение.</p>
            </div>
            <div className="idea-segment">
              <button
                aria-pressed={mode === "new"}
                onClick={() => setMode("new")}
              >
                Новые идеи
              </button>
              <button
                aria-pressed={mode === "rewrite"}
                onClick={() => setMode("rewrite")}
              >
                Переработать промпт
              </button>
            </div>
          </div>
          <div className="idea-generator-fields">
            <label className="idea-field">
              Темы и пожелания
              <textarea
                value={settings.topics}
                onChange={(e) =>
                  setSettings({ ...settings, topics: e.target.value })
                }
                rows={2}
                maxLength={2000}
              />
            </label>
            <label className="idea-field">
              Идей
              <select
                value={settings.dailyCount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyCount: Number(e.target.value),
                  })
                }
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1}>{i + 1}</option>
                ))}
              </select>
            </label>
            <label className="idea-field">
              Язык
              <select
                value={settings.language}
                onChange={(e) =>
                  setSettings({ ...settings, language: e.target.value })
                }
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>
          </div>
          {mode === "rewrite" && (
            <label className="idea-field">
              Исходный промпт
              <textarea
                value={sourcePrompt}
                onChange={(e) => setSourcePrompt(e.target.value)}
                rows={5}
                maxLength={12000}
                placeholder="Вставь исходник. Студия предложит самостоятельные варианты на его основе."
              />
            </label>
          )}
          <div className="idea-panel-bottom">
            <label className="idea-check">
              <input
                type="checkbox"
                checked={settings.useWebSearch}
                onChange={(e) =>
                  setSettings({ ...settings, useWebSearch: e.target.checked })
                }
              />
              Искать вдохновение в интернете
            </label>
            <button
              className="btn-primary"
              disabled={
                busy ||
                !data.configured ||
                settings.topics.trim().length < 3 ||
                (mode === "rewrite" && sourcePrompt.trim().length < 20)
              }
              onClick={() => setConfirmation("generate")}
            >
              <WandSparkles size={16} />
              Подготовить {settings.dailyCount} идей
            </button>
          </div>
        </section>
      )}
      {settingsOpen && (
        <section className="idea-panel">
          <div className="idea-panel-heading">
            <div>
              <h2>Ритм студии</h2>
              <p>
                Автоматическая подборка готовится без публикации. Все результаты
                ждут твоего выбора.
              </p>
            </div>
            <Clock3 size={23} strokeWidth={1.3} />
          </div>
          <label className="idea-check">
            <input
              type="checkbox"
              checked={settings.dailyEnabled}
              onChange={(e) =>
                setSettings({ ...settings, dailyEnabled: e.target.checked })
              }
            />
            Готовить подборку каждый день · {settings.dailyCount} идей с
            изображениями
          </label>
          <div className="idea-schedule-fields">
            <label className="idea-field">
              Время
              <input
                type="time"
                value={settings.runAt}
                onChange={(e) =>
                  setSettings({ ...settings, runAt: e.target.value })
                }
              />
            </label>
            <label className="idea-field">
              Часовой пояс
              <input
                value={settings.timeZone}
                onChange={(e) =>
                  setSettings({ ...settings, timeZone: e.target.value })
                }
              />
            </label>
          </div>
          <p className="idea-help">
            Расписание использует темы, язык и количество из блока новой
            подборки. Включение расписания разрешает ежедневные платные вызовы
            OpenAI. Публикации остаются ручными.
          </p>
          <div className="idea-panel-bottom">
            <span className="idea-help">
              {data.models.text} · {data.models.image} · качество{" "}
              {data.models.imageQuality}
            </span>
            <button
              className="btn-secondary"
              disabled={busy || (settings.dailyEnabled && !data.configured)}
              onClick={() =>
                void run(async () => {
                  await api.saveIdeaStudioSettings(settings);
                }, "Настройки студии сохранены.")
              }
            >
              Сохранить настройки
            </button>
          </div>
        </section>
      )}
      <div className="idea-meta">
        <span>
          <Clock3 size={14} />
          {data.settings.dailyEnabled
            ? `Каждый день в ${data.settings.runAt} · ${data.settings.timeZone}`
            : "Ежедневная генерация выключена"}
        </span>
        <span>
          Сегодня: {data.usage.image}/{data.limits.image} изображений ·{" "}
          {data.usage.text}/{data.limits.text} текстовых запросов{" "}
          <span title="Неудачные и прерванные вызовы тоже учитываются; сброс в 00:00 UTC.">
            ⓘ
          </span>
        </span>
      </div>
      {activeJobs.length > 0 && (
        <div className="idea-progress" role="status">
          <Loader2 size={17} className="idea-spin" />
          <div>
            {activeJobs.map((j) => (
              <p key={j.id}>
                {jobNames[j.kind] || j.kind}:{" "}
                {j.status === "queued"
                  ? "в очереди"
                  : `${j.completed} из ${j.total}`}
              </p>
            ))}
          </div>
          <span>Работа продолжится, даже если закрыть страницу</span>
        </div>
      )}
      {data.jobs.find((j) => j.status === "failed") && (
        <details className="idea-job-errors">
          <summary>Последняя ошибка задачи</summary>
          <p>{data.jobs.find((j) => j.status === "failed")?.error}</p>
        </details>
      )}
      <div className="idea-collection-toolbar">
        <div className="idea-tabs" role="group" aria-label="Фильтр идей">
          {(
            [
              ["new", "На просмотр"],
              ["selected", `Выбрано ${selected.length}`],
              ["published", "В Telegram"],
              ["rejected", "Отклонено"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="idea-batch-select">
          <span className="sr-only">Подборка</span>
          <select
            value={batchId || data.current?.id || ""}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={!data.batches.length}
          >
            <option value="" disabled>
              Подборки
            </option>
            {data.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {dateLabel(batch.createdAt)} ·{" "}
                {statuses[batch.status] || batch.status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {batchContext?.profile && batchContext.calendar && (
        <div className="idea-batch-context">
          {data.current?.hasReference && (
            <div className="idea-batch-avatar">
              <StudioReferencePreview
                batchId={data.current.id}
                version={data.current.id}
              />
            </div>
          )}
          <div>
            <span>
              {batchContext.profile.useCharacter
                ? batchContext.profile.characterName
                : "Без персонажа"}{" "}
              ·{" "}
              {
                themeOptions.find(
                  (x) =>
                    x.key ===
                    batchContext.profile.primaryTheme,
                )?.label
              }
            </span>
            <p className="idea-help">
              {batchContext.calendar.date} ·{" "}
              {batchContext.calendar.region}
              {batchContext.calendar.season
                ? ` · ${batchContext.calendar.season}`
                : ""}
              {data.current?.hasReference
                ? " · лицо из референса этой подборки"
                : ""}
            </p>
          </div>
        </div>
      )}
      {data.current?.error && (
        <p className="idea-help" role="status">
          {data.current.error}
        </p>
      )}
      {visible.length ? (
        <div className="idea-grid">
          {visible.map((draft) => (
            <article
              key={draft.id}
              className={`idea-card${draft.selected ? " is-selected" : ""}${draft.rejected ? " is-rejected" : ""}`}
            >
              <div className="idea-card-image">
                <button
                  className="idea-image-button"
                  aria-label={`Открыть ${draft.title}`}
                  onClick={() => {
                    setEditor({ ...draft });
                    setRewrite("");
                  }}
                >
                  <IdeaImage draft={draft} />
                </button>
                {!draft.promptId && !draft.rejected && (
                  <button
                    className="idea-pick"
                    aria-label={`Выбрать ${draft.title}`}
                    aria-pressed={draft.selected}
                    disabled={busy || Boolean(draft.busyJobId)}
                    onClick={() =>
                      void run(async () => {
                        await api.editIdeaDraft(draft.id, {
                          selected: !draft.selected,
                        });
                      })
                    }
                  >
                    {draft.selected ? <Check size={17} /> : <span />}
                  </button>
                )}
                {draft.busyJobId && (
                  <span className="idea-card-badge">
                    <Loader2 size={12} className="idea-spin" />В работе
                  </span>
                )}
                {draft.imageStale && (
                  <span className="idea-card-badge">
                    Нужно обновить изображение
                  </span>
                )}
              </div>
              <div className="idea-card-body">
                <div className="idea-card-tags">
                  <span>{draft.theme}</span>
                  <span>{draft.visualStyle}</span>
                </div>
                <h2>
                  <button
                    onClick={() => {
                      setEditor({ ...draft });
                      setRewrite("");
                    }}
                  >
                    {draft.title}
                  </button>
                </h2>
                <p className="idea-card-concept">{draft.concept}</p>
                {draft.imageError && (
                  <p className="idea-card-error">{draft.imageError}</p>
                )}
                {draft.publishError && (
                  <p className="idea-card-error">{draft.publishError}</p>
                )}
                {draft.prompt?.telegramPostUrl ? (
                  <div className="idea-published">
                    <a
                      href={draft.prompt.telegramPostUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <CheckCheck size={15} />
                      Пост в Telegram
                      <ArrowUpRight size={13} />
                    </a>
                    <a href={`/p/${draft.promptId}`}>Открыть материал</a>
                    {draft.prompt.pinterestPublished ? (
                      <span>Опубликовано в Pinterest</span>
                    ) : pinterest?.environment === "production" &&
                      pinterest.connected &&
                      !pinterest.needsReconnect ? (
                      <button
                        className="idea-text-button"
                        disabled={busy}
                        onClick={() => void publishPin(draft)}
                      >
                        Опубликовать в Pinterest
                      </button>
                    ) : (
                      <button
                        className="idea-text-button"
                        onClick={onOpenSettings}
                        disabled={!onOpenSettings}
                      >
                        Pinterest — после Standard access
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="idea-card-actions">
                    <button
                      className="idea-text-button"
                      onClick={() => {
                        setEditor({ ...draft });
                        setRewrite("");
                      }}
                    >
                      Посмотреть
                    </button>
                    {!draft.promptId && (
                      <button
                        className="idea-muted-button"
                        disabled={busy || Boolean(draft.busyJobId)}
                        onClick={() =>
                          void run(async () => {
                            await api.editIdeaDraft(draft.id, {
                              rejected: !draft.rejected,
                            });
                          })
                        }
                      >
                        {draft.rejected ? "Вернуть" : "Отклонить"}
                      </button>
                    )}
                  </div>
                )}
                {draft.publishUncertain && !draft.prompt?.telegramPostUrl && (
                  <div className="idea-uncertain">
                    <p>
                      Проверь канал. Если пост уже есть, сохрани его ссылку в
                      карточке материала.
                    </p>
                    <a href={`/p/${draft.promptId}`}>Открыть карточку</a>
                    <button
                      className="idea-text-button"
                      disabled={busy || Boolean(draft.busyJobId)}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Я проверил Telegram-канал: этого поста нет. Разрешить повторную отправку?",
                          )
                        )
                          void run(async () => {
                            await api.allowIdeaTelegramRetry(draft.id);
                          });
                      }}
                    >
                      Проверил: поста нет
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="idea-empty">
          <Sparkles size={30} strokeWidth={1.2} />
          <h2>
            {activeJobs.length
              ? "Идеи скоро появятся"
              : filter === "selected"
                ? "Отметь то, что нравится"
                : filter === "published"
                  ? "Здесь будут опубликованные идеи"
                  : filter === "rejected"
                    ? "Отклонённых идей пока нет"
                    : "Место для следующей идеи"}
          </h2>
          <p>
            {activeJobs.length
              ? "Тексты появятся первыми, затем добавятся изображения."
              : filter === "selected"
                ? "Нажми кружок на карточке — идея попадёт в твой отбор."
                : "Подготовь подборку и выбери материалы для своего канала."}
          </p>
        </div>
      )}
      {data.current && data.current.sources.length > 0 && (
        <details className="idea-sources">
          <summary>
            Источники вдохновения · {data.current.sources.length}
          </summary>
          <p>
            Использованы для поиска направлений; готовые промпты создаются
            заново.
          </p>
          {data.current.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.title}
              <ArrowUpRight size={13} />
            </a>
          ))}
        </details>
      )}
      {selected.length > 0 && (
        <div className="idea-selection-bar">
          <div>
            <span className="idea-selection-count">{selected.length}</span>
            <div>
              В твоём отборе
              <p>
                {canPublish
                  ? "Изображения готовы. Можно публиковать."
                  : "Дождись изображений и проверь незавершённые материалы."}
              </p>
            </div>
          </div>
          <button
            className="btn-primary"
            disabled={busy || !canPublish}
            onClick={() => setConfirmation("publish")}
          >
            <Send size={16} />
            Опубликовать выбранное
          </button>
        </div>
      )}

      {confirmation && (
        <StudioDialog
          title={
            confirmation === "generate"
              ? "Подготовить подборку?"
              : "Публикация в Telegram"
          }
          onClose={() => setConfirmation(null)}
          busy={busy}
        >
          {confirmation === "generate" ? (
            <div className="idea-confirm-body">
              <p>
                Будет создано {settings.dailyCount} идей и {settings.dailyCount}{" "}
                изображений через платный OpenAI API.
                {settings.useWebSearch
                  ? " Также будет выполнен поиск вдохновения."
                  : ""}
              </p>
              <p className="idea-help">
                Осталось на сегодня:{" "}
                {Math.max(0, data.limits.image - data.usage.image)} вызовов
                изображений. Неудачные запросы тоже учитываются. Результаты
                сохранятся в черновиках.
              </p>
              {settings.creativeProfile.useCharacter && (
                <p className="idea-help">
                  {data.reference.available
                    ? "Для превью используем сохранённое фото персонажа. Публичный промпт будет подходить для другого референса."
                    : "Фото не загружено: превью будет иллюстративным, с придуманной моделью. Публичный промпт рассчитан на загрузку своего референса."}
                </p>
              )}
              <button
                className="btn-primary"
                disabled={
                  busy ||
                  settings.dailyCount > data.limits.image - data.usage.image
                }
                onClick={() => void generate()}
              >
                {busy ? (
                  <Loader2 size={16} className="idea-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Начать генерацию
              </button>
            </div>
          ) : (
            <div className="idea-confirm-body">
              <p>
                В Telegram-канал будут отправлены {selected.length} выбранных
                материалов. Они также появятся в библиотеке сайта.
              </p>
              <div className="idea-confirm-list">
                {selected.map((d) => (
                  <div key={d.id}>
                    {d.imageUrl && (
                      <img src={resolveMediaUrl(d.imageUrl)} alt="" />
                    )}
                    <div>
                      <strong>{d.title}</strong>
                      <p>{d.content.slice(0, 200)}…</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="idea-help">
                После отправки сохраним ссылку каждого поста. Pinterest
                публикуется отдельным подтверждением.
              </p>
              <button
                className="btn-primary"
                disabled={busy || !canPublish}
                onClick={() =>
                  void run(async () => {
                    await api.publishIdeaDrafts(selected.map((d) => d.id));
                    setConfirmation(null);
                  }, "Выбранные материалы поставлены в очередь Telegram.")
                }
              >
                <Send size={16} />
                Подтверждаю публикацию
              </button>
            </div>
          )}
        </StudioDialog>
      )}
      {editor && (
        <StudioDialog
          title={editor.title}
          onClose={() => setEditor(undefined)}
          busy={busy}
          wide
        >
          <div className="idea-editor">
            <div className="idea-editor-image">
              <IdeaImage draft={editor} full />
            </div>
            <div className="idea-editor-fields">
              <label className="idea-field">
                Название
                <input
                  value={editor.title}
                  maxLength={100}
                  disabled={Boolean(editor.promptId || editor.busyJobId)}
                  onChange={(e) =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                />
              </label>
              <label className="idea-field">
                Идея
                <textarea
                  rows={3}
                  value={editor.concept}
                  disabled={Boolean(editor.promptId || editor.busyJobId)}
                  onChange={(e) =>
                    setEditor({ ...editor, concept: e.target.value })
                  }
                />
              </label>
              <label className="idea-field">
                Промпт
                <textarea
                  rows={9}
                  value={editor.content}
                  disabled={Boolean(editor.promptId || editor.busyJobId)}
                  onChange={(e) =>
                    setEditor({ ...editor, content: e.target.value })
                  }
                />
              </label>
              <details>
                <summary>Задание для изображения</summary>
                <label className="idea-field">
                  <span className="sr-only">Задание для изображения</span>
                  <textarea
                    rows={6}
                    value={editor.imagePrompt}
                    disabled={Boolean(editor.promptId || editor.busyJobId)}
                    onChange={(e) =>
                      setEditor({ ...editor, imagePrompt: e.target.value })
                    }
                  />
                </label>
              </details>
              {!editor.promptId && !editor.busyJobId && !editor.rejected ? (
                <>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void saveEditor()}
                  >
                    <Check size={16} />
                    Сохранить изменения
                  </button>
                  <div className="idea-rewrite">
                    <label className="idea-field">
                      Что изменить с помощью ИИ?
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={rewrite}
                        onChange={(e) => setRewrite(e.target.value)}
                        placeholder="Например: перенеси сцену в ночной Токио"
                      />
                    </label>
                    <button
                      className="btn-secondary"
                      disabled={
                        busy || !data.configured || rewrite.trim().length < 3
                      }
                      onClick={() =>
                        void run(async () => {
                          await api.editIdeaDraft(editor.id, {
                            title: editor.title,
                            concept: editor.concept,
                            content: editor.content,
                            imagePrompt: editor.imagePrompt,
                          });
                          await api.rewriteIdeaDraft(editor.id, rewrite);
                          setEditor(undefined);
                        }, "Перерабатываем текст. Затем понадобится новое изображение.")
                      }
                    >
                      <WandSparkles size={15} />
                      Переработать текст
                    </button>
                  </div>
                  <button
                    className="btn-secondary"
                    disabled={busy || !data.configured}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Сохранить изменения и сгенерировать новое изображение? Это платный вызов OpenAI.",
                        )
                      )
                        void run(async () => {
                          await api.editIdeaDraft(editor.id, {
                            title: editor.title,
                            concept: editor.concept,
                            content: editor.content,
                            imagePrompt: editor.imagePrompt,
                          });
                          await api.regenerateIdeaImage(editor.id);
                          setEditor(undefined);
                        }, "Изображение поставлено в очередь.");
                    }}
                  >
                    <RefreshCw size={15} />
                    Новое изображение
                  </button>
                  <p className="idea-help">
                    Изменение текста делает прежнее изображение неактуальным.
                    При генерации и переработке текущие изменения сохраняются
                    автоматически.
                  </p>
                </>
              ) : (
                <p className="idea-help">
                  {editor.promptId
                    ? "Материал уже передан на публикацию. Дальнейшее редактирование — в карточке библиотеки."
                    : "Черновик занят или отклонён. Верни его в работу после завершения задачи."}
                </p>
              )}
            </div>
          </div>
        </StudioDialog>
      )}
    </section>
  );
}
