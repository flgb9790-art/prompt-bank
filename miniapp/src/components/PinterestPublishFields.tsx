import { useEffect, useRef, useState } from "react";
import { derivePromptTitle } from "../utils/promptTitle";
import { defaultPinterestDescriptionText, isValidPinterestLink } from "../utils/pinterestPublish";

export type PinterestPublishValue = {
  title: string;
  description: string;
  link: string;
};

type Props = {
  enabled: boolean;
  promptContent: string;
  categoryName: string;
  value: PinterestPublishValue;
  onChange: (value: PinterestPublishValue) => void;
  showErrors?: boolean;
  publishToTelegram?: boolean;
};

export function emptyPinterestPublishValue(): PinterestPublishValue {
  return { title: "", description: "", link: "" };
}

export function PinterestPublishFields({
  enabled,
  promptContent,
  categoryName,
  value,
  onChange,
  showErrors = false,
  publishToTelegram = false
}: Props) {
  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);

  const promptTitle = derivePromptTitle(promptContent);
  const defaultDescription = defaultPinterestDescriptionText(categoryName);
  const defaultLink = "";
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!enabled) return;
    const current = valueRef.current;
    const next = {
      title: titleTouched ? current.title : promptTitle,
      description: descriptionTouched ? current.description : defaultDescription,
      link: linkTouched ? current.link : defaultLink
    };
    if (
      next.title !== current.title ||
      next.description !== current.description ||
      next.link !== current.link
    ) {
      onChange(next);
    }
  }, [
    enabled,
    promptTitle,
    defaultDescription,
    defaultLink,
    titleTouched,
    descriptionTouched,
    linkTouched,
    onChange
  ]);

  if (!enabled) return null;

  const titleError = showErrors && !value.title.trim() ? "Введите название пина" : "";
  const descriptionError = showErrors && !value.description.trim() ? "Введите описание пина" : "";
  const linkEmptyError = showErrors && !publishToTelegram && !value.link.trim() ? "Введите ссылку на существующий Telegram-пост" : "";
  const linkInvalidError =
    showErrors && !publishToTelegram && value.link.trim() && !isValidPinterestLink(value.link) ? "Нужна ссылка на конкретный Telegram-пост" : "";
  const linkError = linkEmptyError || linkInvalidError;

  return (
    <div className="pinterest-publish-block">
      <div className="pinterest-publish-header">
        <p className="pinterest-publish-title">Pinterest-публикация</p>
        <p className="pinterest-publish-subtext">Настройте, как пин будет выглядеть в Pinterest.</p>
      </div>

      <div className="pinterest-publish-fields">
        <div className="pinterest-publish-field">
          <label className="pinterest-publish-label" htmlFor="pinterest-pin-title">
            Название пина
          </label>
          <input
            id="pinterest-pin-title"
            type="text"
            className="pinterest-publish-input"
            placeholder="Введите название пина"
            value={value.title}
            onChange={(event) => {
              setTitleTouched(true);
              onChange({ ...value, title: event.target.value });
            }}
          />
          <p className="pinterest-publish-hint">Обычно это короткое название промпта.</p>
          {titleError ? <p className="pinterest-publish-error">{titleError}</p> : null}
        </div>

        <div className="pinterest-publish-field">
          <label className="pinterest-publish-label" htmlFor="pinterest-pin-description">
            Описание пина
          </label>
          <textarea
            id="pinterest-pin-description"
            className="pinterest-publish-textarea"
            placeholder="Введите описание для Pinterest"
            value={value.description}
            onChange={(event) => {
              setDescriptionTouched(true);
              onChange({ ...value, description: event.target.value });
            }}
          />
          {descriptionError ? <p className="pinterest-publish-error">{descriptionError}</p> : null}
        </div>

        <div className="pinterest-publish-field">
          <label className="pinterest-publish-label" htmlFor="pinterest-pin-link">
            Ссылка назначения — Telegram-пост
          </label>
          <input
            id="pinterest-pin-link"
            type="url"
            className="pinterest-publish-input"
            placeholder={publishToTelegram ? "Будет получена после отправки в Telegram" : "https://t.me/channel/123"}
            disabled={publishToTelegram}
            value={publishToTelegram ? "" : value.link}
            onChange={(event) => {
              setLinkTouched(true);
              onChange({ ...value, link: event.target.value });
            }}
          />
          <p className="pinterest-publish-hint">
            {publishToTelegram
              ? "Сначала отправим Telegram-пост, затем покажем точную ссылку для подтверждения создания пина."
              : "Для существующего материала укажите уже опубликованный пост. Повторной отправки в Telegram не будет."}
          </p>
          {linkError ? <p className="pinterest-publish-error">{linkError}</p> : null}
        </div>
      </div>

      <div className="pinterest-publish-preview">
        <p className="pinterest-publish-preview-title">{value.title.trim() || "Название пина"}</p>
        <p className="pinterest-publish-preview-description">
          {value.description.trim() || "Описание пина появится здесь."}
        </p>
        {!publishToTelegram && value.link.trim() ? <p className="pinterest-publish-preview-link">{value.link.trim()}</p> : null}
      </div>
    </div>
  );
}

export function validatePinterestPublishValue(value: PinterestPublishValue, publishToTelegram = false): boolean {
  return Boolean(value.title.trim() && value.description.trim() && (publishToTelegram || isValidPinterestLink(value.link)));
}
