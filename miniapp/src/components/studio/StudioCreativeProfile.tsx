import { useEffect, useState } from "react";
import { Camera, ChevronDown, Upload, X } from "lucide-react";
import { api } from "../../api";
import type { StudioCreativeProfile as Profile } from "../../ideaStudioTypes";

export const themeOptions = [
  { key: "luxury", label: "Роскошная жизнь" },
  { key: "travel", label: "Путешествия" },
  { key: "fashion", label: "Мода и образы" },
  { key: "everyday", label: "Повседневность" },
  { key: "wellness", label: "Спорт и wellness" },
  { key: "cinematic", label: "Кино и фантазия" },
  { key: "nature", label: "Город и природа" },
];
export function StudioReferencePreview({
  version,
  batchId,
}: {
  version: string | null;
  batchId?: string;
}) {
  const [url, setUrl] = useState<string>(),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true,
      objectUrl: string | undefined;
    setUrl(undefined);
    setFailed(false);
    if (version)
      void api
        .ideaReferenceImage(batchId, true)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version, batchId]);
  return url ? (
    <img src={url} alt="Выровненный референс лица" />
  ) : (
    <div className="idea-reference-placeholder">
      <Camera size={24} strokeWidth={1.3} />
      {failed && <span>Не удалось загрузить фото</span>}
    </div>
  );
}
export function StudioCreativeProfile({
  value,
  onChange,
  reference,
  busy,
  onUpload,
  onRemove,
  onSave,
}: {
  value: Profile;
  onChange: (value: Profile) => void;
  reference: { available: boolean; version: string | null };
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const theme = themeOptions.find((x) => x.key === value.primaryTheme)?.label;
  return (
    <details
      className="idea-panel idea-character-panel"
      open={!reference.available || undefined}
    >
      <summary className="idea-character-summary">
        <div>
          <Camera size={18} />
          <span>
            Персонаж и темы
            <small>
              {value.useCharacter
                ? `${value.characterName} · ${theme}`
                : "Свободные идеи без персонажа"}
            </small>
          </span>
        </div>
        <ChevronDown size={17} />
      </summary>
      <div className="idea-character-layout">
        <div className="idea-character-reference">
          <div className={`idea-reference-image${reference.available?"":" is-empty"}`}>
            <StudioReferencePreview version={reference.version} />
          </div>
          <label
            className={`btn-secondary idea-upload${busy ? " is-disabled" : ""}`}
          >
            <Upload size={15} />
            {reference.available ? "Заменить фото" : "Загрузить фото"}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(file);
              }}
            />
          </label>
          {reference.available && (
            <button
              className="idea-muted-button"
              disabled={busy}
              onClick={onRemove}
            >
              <X size={13} />
              Убрать из профиля
            </button>
          )}
          <p className="idea-help">
            Чёткое фото одного лица с видимыми глазами, JPG / PNG / WebP до 10 МБ.
            Перед генерацией лицо кадрируется и выравнивается локально.
            Исходник хранится приватно; в OpenAI передаётся подготовленный портрет.
          </p>
        </div>
        <div className="idea-character-fields">
          <label className="idea-check">
            <input
              type="checkbox"
              checked={value.useCharacter}
              onChange={(e) =>
                onChange({ ...value, useCharacter: e.target.checked })
              }
            />
            Создавать идеи для этого персонажа
          </label>
          <div className="idea-character-name-row">
            <label className="idea-field">
              Название персонажа
              <input
                value={value.characterName}
                maxLength={80}
                onChange={(e) =>
                  onChange({ ...value, characterName: e.target.value })
                }
                placeholder="Например: Анна"
              />
            </label>
            <label className="idea-field">
              Главная тематика
              <select
                value={value.primaryTheme}
                onChange={(e) =>
                  onChange({
                    ...value,
                    primaryTheme: e.target.value,
                    extraThemes: value.extraThemes.filter(
                      (key) => key !== e.target.value,
                    ),
                  })
                }
              >
                {themeOptions.map((theme) => (
                  <option key={theme.key} value={theme.key}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="idea-field">
            Пожелания к персонажу и образам
            <textarea
              rows={2}
              maxLength={1500}
              value={value.characterDescription}
              onChange={(e) =>
                onChange({ ...value, characterDescription: e.target.value })
              }
              placeholder="Характер, стиль и настроение. Внешность берём из фото."
            />
          </label>
          <fieldset className="idea-theme-options">
            <legend>Дополнительные темы для разнообразия</legend>
            {themeOptions
              .filter((theme) => theme.key !== value.primaryTheme)
              .map((theme) => (
                <label
                  key={theme.key}
                  className={
                    value.extraThemes.includes(theme.key) ? "is-selected" : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={value.extraThemes.includes(theme.key)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        extraThemes: e.target.checked
                          ? [...value.extraThemes, theme.key]
                          : value.extraThemes.filter(
                              (key) => key !== theme.key,
                            ),
                      })
                    }
                  />
                  {theme.label}
                </label>
              ))}
          </fieldset>
          <div className="idea-calendar-options">
            <label className="idea-check">
              <input
                type="checkbox"
                checked={value.seasonal}
                onChange={(e) =>
                  onChange({ ...value, seasonal: e.target.checked })
                }
              />
              Учитывать время года
            </label>
            <label className="idea-check">
              <input
                type="checkbox"
                checked={value.holidays}
                onChange={(e) =>
                  onChange({ ...value, holidays: e.target.checked })
                }
              />
              Предлагать идеи к праздникам
            </label>
          </div>
          <div className="idea-character-name-row">
            <label className="idea-field">
              Регион и культурный контекст
              <input
                value={value.region}
                maxLength={150}
                onChange={(e) => onChange({ ...value, region: e.target.value })}
              />
            </label>
            <label className="idea-field">
              Сезон
              <select
                value={value.hemisphere}
                onChange={(e) =>
                  onChange({
                    ...value,
                    hemisphere: e.target.value as "north" | "south",
                  })
                }
              >
                <option value="north">Северное полушарие</option>
                <option value="south">Южное полушарие</option>
              </select>
            </label>
          </div>
          <p className="idea-help">
            Главная тема преобладает; остальные добавляют разнообразие. Сезон и
            поводы учитываются по дате генерации. Референс закрепляется за
            подборкой: замена или удаление фото из профиля не меняет старые
            подборки.
          </p>
          {value.useCharacter && !reference.available && (
            <p className="idea-help">
              Без фото превью будет примером с придуманной моделью. Чтобы
              использовать лицо своей девушки, загрузи референс.
            </p>
          )}
          <div className="idea-profile-footer">
            <p className="idea-help">
              Публичные промпты универсальны: подробные одежда, образ и сцена,
              без формата и разрешения. Любой человек из референса сможет стать
              героем кадра.
            </p>
            <button className="btn-secondary" disabled={busy} onClick={onSave}>
              Сохранить персонажа и темы
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
