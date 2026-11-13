import { createHash } from "node:crypto";

export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function studioString(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new StudioError(`${label}: от ${min} до ${max} символов.`);
  }
  return value.trim();
}
export function studioCount(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  ) {
    throw new StudioError("Количество идей должно быть от 1 до 10.");
  }
  return value;
}
export function studioBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean")
    throw new StudioError(`Неверное значение: ${label}.`);
  return value;
}
export function validateStudioSettings(input: any) {
  const runAt = studioString(input.runAt, "Время", 5, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runAt))
    throw new StudioError("Время должно быть в формате ЧЧ:ММ.");
  const timeZone = studioString(input.timeZone, "Часовой пояс", 1, 80);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new StudioError("Неизвестный часовой пояс.");
  }
  if (!["en", "ru"].includes(input.language))
    throw new StudioError("Выберите русский или английский язык.");
  return {
    dailyEnabled: studioBoolean(input.dailyEnabled, "Расписание"),
    dailyCount: studioCount(input.dailyCount),
    runAt,
    timeZone,
    language: input.language as string,
    topics: studioString(input.topics, "Тематики", 3, 2000),
    useWebSearch: studioBoolean(input.useWebSearch, "Поиск идей"),
  };
}
export function localStudioClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function fingerprint(text: string) {
  return createHash("sha256")
    .update(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim(),
    )
    .digest("hex");
}
const stop = new Set(
  "the and with for from this that into create image photo prompt same use using realistic cinematic lighting background high quality detailed a an of in on to is as at by or и в на с для из по это как создай изображение фото промпт".split(
    " ",
  ),
);
function tokens(text: string) {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(
      (x) => !stop.has(x),
    ),
  );
}
export function ideaComparisonText(text: string) {
  const headings = [...text.matchAll(/^(Outfit and accessories|Styling|Pose and expression|Scene|Lighting|Camera and composition|Textures and finish|Одежда и аксессуары|Образ|Поза и выражение|Сцена|Свет|Камера и композиция|Текстуры и обработка):[ \t]*/gimu)];
  const sections = new Map(headings.map((match, i) => [
    match[1].toLowerCase(), text.slice(match.index! + match[0].length, headings[i+1]?.index ?? text.length).trim(),
  ]));
  const scene = sections.get("scene") || sections.get("сцена");
  if (scene) return [scene, sections.get("pose and expression") || sections.get("поза и выражение")].filter(Boolean).join("\n");
  // Identity instructions are shared across unrelated prompts and are not an idea.
  return text.split(/\n\s*\n/).flatMap(paragraph => {
    if (!/^(?:Use (?:the person in the uploaded photograph|my reference photo|the (?:attached|uploaded|reference) (?:photo|image))|Используй (?:человека из приложенной фотографии|мо[её] (?:фото|референс)|(?:приложенное|загруженное) фото))/iu.test(paragraph.trim())) return [paragraph];
    // Older prompts often join the identity preamble and actual scene into one
    // paragraph. Keep the creative task instead of losing the entire scene.
    const scene = paragraph.match(/\b(?:Create|Capture|Photograph|Generate|Depict|Imagine)\b[\s\S]*|(?:Создай(?:те)?|Сфотографируй|Изобрази|Сними)\s[\s\S]*/iu)?.[0];
    return scene ? [scene] : [];
  }).join("\n\n").trim();
}
export function similarIdea(a: string, b: string) {
  if (!a.trim() || !b.trim()) return false;
  if (fingerprint(a) === fingerprint(b)) return true;
  const left = ideaComparisonText(a), right = ideaComparisonText(b);
  if (!left || !right) return false;
  if (fingerprint(left) === fingerprint(right)) return true;
  const aa = tokens(left),
    bb = tokens(right);
  const overlap = [...aa].filter((x) => bb.has(x)).length;
  return (
    aa.size >= 5 && bb.size >= 5 && overlap / Math.max(aa.size, bb.size) >= 0.72
  );
}
export type GeneratedIdea = {
  title: string;
  concept: string;
  content: string;
  imagePrompt: string;
  theme: string;
  visualStyle: string;
};
export function validateGeneratedIdeas(
  value: any,
  count: number,
  language: string,
  previous: Array<{ title: string; concept: string; content?: string }>,
  options: { skipDuplicates?: boolean } = {},
) {
  if (!value || !Array.isArray(value.ideas) || value.ideas.length !== count)
    throw new StudioError(
      "ИИ вернул неполную подборку. Повторите генерацию.",
      502,
    );
  const accepted: GeneratedIdea[] = [];
  for (const idea of value.ideas) {
    const row: GeneratedIdea = {
      title: studioString(idea.title, "Название", 3, 100),
      concept: studioString(idea.concept, "Идея", 15, 1500),
      content: studioString(idea.content, "Промпт", 80, 12000),
      imagePrompt: studioString(
        idea.imagePrompt,
        "Задание для изображения",
        50,
        14000,
      ),
      theme: studioString(idea.theme, "Тема", 2, 100),
      visualStyle: studioString(idea.visualStyle, "Стиль", 2, 150),
    };
    const words = row.title.split(/\s+/);
    if (words.length < 2 || words.length > 3)
      throw new StudioError(
        "ИИ вернул название не в 2–3 слова. Повторите генерацию.",
        502,
      );
    if (
      (language === "en" && /[а-яё]/iu.test(row.title)) ||
      (language === "ru" && !/[а-яё]/iu.test(row.title))
    )
      throw new StudioError(
        "Язык названия не соответствует выбранному языку.",
        502,
      );
    if (
      [...previous, ...accepted].some(
        (p) =>
          similarIdea(row.concept, p.concept) ||
          (p.content && similarIdea(row.content, p.content)),
      )
    ) {
      if (options.skipDuplicates) continue;
      throw new StudioError(
        "В подборке обнаружена похожая идея. Автоматического платного повтора нет: измените темы и запустите новую подборку.",
        502,
      );
    }
    accepted.push(row);
  }
  if (!accepted.length) throw new StudioError("Все предложенные сцены повторяют уже сохранённые идеи. Новых изображений не создавали. Уточните места, действия или сюжет для следующей подборки.", 502);
  return accepted;
}
