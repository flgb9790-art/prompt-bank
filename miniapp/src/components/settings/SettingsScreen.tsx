import { useEffect, useState } from "react";
import { ArrowRight, Copy, Eye, Mail, Send, Shield } from "lucide-react";
import type { MeResponse, TelegramUser, UserSettings } from "../../types";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { formatRegistrationDate } from "../../utils/formatRelativeTime";
import { ProfileAvatar } from "./ProfileAvatar";
import { ReadingSettings } from "./ReadingSettings";
import { PinterestSettings } from "./PinterestSettings";

type Props = {
  user: TelegramUser | null;
  me: MeResponse | null;
  isAuthenticated: boolean;
  variant?: "web" | "mini";
  onNavigateCopied: () => void;
  onNavigateViewed: () => void;
  onLogout: () => void;
  onLogin: () => void;
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  showLogout?: boolean;
  onOpenPrivacyPolicy?: () => void;
};

function displayName(user: TelegramUser | null, me: MeResponse | null) {
  const first = me?.user?.firstName ?? user?.first_name;
  const last = me?.user?.lastName ?? user?.last_name;
  const joined = [first, last].filter(Boolean).join(" ");
  if (joined) return joined;
  if (user?.username || me?.user?.username) {
    return `@${user?.username ?? me?.user?.username}`;
  }
  return "Пользователь";
}

export function SettingsScreen({
  user,
  me,
  isAuthenticated,
  variant = "web",
  onNavigateCopied,
  onNavigateViewed,
  onLogout,
  onLogin,
  onUpdateSettings,
  showLogout = true,
  onOpenPrivacyPolicy
}: Props) {
  const stats = me?.stats;
  const settings = me?.settings;
  const username = user?.username ?? me?.user?.username ?? null;
  const isMini = variant === "mini";
  const [privacySettings, setPrivacySettings] = useState({
    saveViewHistory: settings?.saveViewHistory ?? true,
    saveCopyHistory: settings?.saveCopyHistory ?? true
  });
  const [savingKey, setSavingKey] = useState<"saveViewHistory" | "saveCopyHistory" | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    setPrivacySettings({
      saveViewHistory: settings?.saveViewHistory ?? true,
      saveCopyHistory: settings?.saveCopyHistory ?? true
    });
  }, [settings?.saveViewHistory, settings?.saveCopyHistory]);

  async function handlePrivacyToggle(key: "saveViewHistory" | "saveCopyHistory", checked: boolean) {
    const previous = privacySettings;
    setPrivacySettings((current) => ({ ...current, [key]: checked }));
    setSavingKey(key);
    setSettingsMessage("Сохраняем настройку…"); setSettingsError(false);
    try {
      await onUpdateSettings({ [key]: checked });
      setSettingsMessage("Настройка сохранена");
    } catch {
      setPrivacySettings(previous);
      setSettingsMessage("Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.");
      setSettingsError(true);
    } finally {
      setSavingKey(null);
    }
  }

  const privacyFooter =
    !isMini && onOpenPrivacyPolicy ? (
      <footer className="settings-legal-footer">
        <a
          href="/privacy"
          className="settings-legal-link"
          onClick={(event) => {
            event.preventDefault();
            onOpenPrivacyPolicy();
          }}
        >
          Политика конфиденциальности
        </a>
      </footer>
    ) : null;

  if (!isAuthenticated) {
    return (
      <div className={isMini ? "settings-page settings-page--mini" : "settings-page"}>
        <header className="settings-page-header">
          <h1 className="settings-page-title">Настройки</h1>
          <p className="settings-page-subtitle">Войдите через Telegram, чтобы управлять профилем и историей.</p>
        </header>
        <div className="settings-card settings-card--full">
          <p className="text-sm text-[var(--muted)]">Нужно войти для доступа к профилю, аккаунту и истории промптов.</p>
          <button type="button" className="btn-primary mt-4" onClick={onLogin}>
            Войти через Telegram
          </button>
        </div>
        <ReadingSettings />
        {privacyFooter}
      </div>
    );
  }

  const profileCard = (
    <section className="settings-card settings-card--compact">
      <h2 className="settings-card-title">Профиль</h2>
      <div className="settings-profile-content">
        <ProfileAvatar user={user} me={me} />
        <div className="min-w-0">
          <p className="settings-profile-name">{displayName(user, me)}</p>
          {username ? (
            <p className="settings-profile-meta">
              <Send size={16} />
              @{username}
            </p>
          ) : null}
          <p className="settings-profile-meta">
            <Mail size={16} />
            Telegram ID: {user?.id ?? me?.user?.telegramId}
          </p>
          {showLogout ? (
            <button type="button" className="settings-logout-btn" onClick={onLogout}>
              Выйти
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );

  const accountCard = (
    <section className="settings-card settings-card--compact">
      <h2 className="settings-card-title">Аккаунт</h2>
      <div className="settings-account-status">
        <div className="settings-account-icon">
          <Send size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="settings-account-title">Telegram подключен</p>
          <p className="settings-account-subtitle">Аккаунт успешно привязан</p>
        </div>
        <span className="settings-badge">Подключено</span>
      </div>
      <div className="settings-info-rows">
        <div className="settings-info-row">
          <span>Дата регистрации</span>
          <span>{settings?.createdAt ? formatRegistrationDate(settings.createdAt) : "—"}</span>
        </div>
        <div className="settings-info-row">
          <span>Добавленных промптов</span>
          <span>{stats?.createdPromptsCount ?? 0}</span>
        </div>
        <div className="settings-info-row">
          <span>Последний вход</span>
          <span>Сейчас</span>
        </div>
      </div>
    </section>
  );

  const actionCards = (
    <>
      <button type="button" className="settings-action-card settings-action-card--compact" onClick={onNavigateCopied}>
        <div className="settings-action-card-left">
          <div className="settings-action-icon settings-action-icon--compact">
            <Copy size={28} strokeWidth={2} />
          </div>
          <div>
            <p className="settings-action-title">Скопированные промпты</p>
            <p className="settings-action-description">Посмотреть историю скопированных промптов</p>
          </div>
        </div>
        <div className="settings-action-arrow settings-action-arrow--compact">
          <ArrowRight size={20} />
        </div>
      </button>
      <button type="button" className="settings-action-card settings-action-card--compact" onClick={onNavigateViewed}>
        <div className="settings-action-card-left">
          <div className="settings-action-icon settings-action-icon--compact">
            <Eye size={28} strokeWidth={2} />
          </div>
          <div>
            <p className="settings-action-title">Просмотренные промпты</p>
            <p className="settings-action-description">Посмотреть историю просмотренных промптов</p>
          </div>
        </div>
        <div className="settings-action-arrow settings-action-arrow--compact">
          <ArrowRight size={20} />
        </div>
      </button>
    </>
  );

  const privacyCard = (
    <section className="settings-card settings-card--full settings-card--compact">
      <h2 className="settings-card-title">Приватность</h2>
      <div className="settings-privacy-row">
        <div className="settings-privacy-icon">
          <Eye size={20} />
        </div>
        <ToggleSwitch
          checked={privacySettings.saveViewHistory}
          disabled={savingKey !== null}
          onChange={(checked) => void handlePrivacyToggle("saveViewHistory", checked)}
          label="Сохранять историю просмотров"
          description="Сохранять промпты, которые вы просматриваете"
        />
      </div>
      <div className="settings-privacy-row settings-privacy-row--last">
        <div className="settings-privacy-icon">
          <Shield size={20} />
        </div>
        <ToggleSwitch
          checked={privacySettings.saveCopyHistory}
          disabled={savingKey !== null}
          onChange={(checked) => void handlePrivacyToggle("saveCopyHistory", checked)}
          label="Сохранять историю копирования"
          description="Сохранять скопированные промпты для быстрого доступа"
        />
      </div>
      <p className="settings-help">Отключение истории влияет на новые действия. Уже сохранённые промпты остаются в истории.</p>
      {settingsMessage ? <p role={settingsError ? "alert" : "status"} className={`settings-save-status${settingsError ? " is-error" : ""}`}>{settingsMessage}</p> : null}
    </section>
  );

  if (isMini) {
    return (
      <div className="settings-page settings-page--mini">
        <header className="settings-page-header">
          <h1 className="settings-page-title settings-page-title--mini">Профиль</h1>
          <p className="settings-page-subtitle">Ваш аккаунт и личная история промптов</p>
        </header>
        <div className="settings-stack settings-stack--mini">
          <section className="settings-card settings-card--compact settings-profile-card-mobile">
            <div className="settings-profile-content settings-profile-content--mobile">
              <ProfileAvatar user={user} me={me} size="sm" />
              <div className="min-w-0">
                <p className="settings-profile-name settings-profile-name--mobile">{displayName(user, me)}</p>
                {username ? <p className="settings-profile-meta">@{username}</p> : null}
              </div>
            </div>
          </section>
          {actionCards}
          {privacyCard}
          {me?.isAdmin && <PinterestSettings />}
          <ReadingSettings />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1 className="settings-page-title">Настройки</h1>
        <p className="settings-page-subtitle">Управляйте профилем, аккаунтом и личной историей промптов.</p>
      </header>
      <div className="settings-grid">
        {profileCard}
        {accountCard}
        {actionCards}
        {privacyCard}
        {me?.isAdmin && <PinterestSettings />}
        <ReadingSettings />
      </div>
      {privacyFooter}
    </div>
  );
}
