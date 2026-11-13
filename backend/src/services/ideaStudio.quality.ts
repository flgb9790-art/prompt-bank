import { StudioError } from "./ideaStudio.validation";
import type { CreativeContext } from "./ideaStudio.creative";

export const RECIPE_FIELDS = [
  "wardrobe",
  "styling",
  "poseExpression",
  "scene",
  "lighting",
  "cameraComposition",
  "finish",
] as const;
export function validateReusablePrompt(text: string) {
  if (
    /\b\d{1,4}\s*[:×x]\s*\d{1,4}\b|\b(?:4|8|16|32)[kк]\b|--ar\b|\b(?:aspect[ -]?ratio|resolution|dpi|ppi|pixels?|megapixels?|image format|output format|portrait orientation|landscape orientation|square format)\b|разрешени[ея]|соотношени[ея]\s+сторон|формат[а-я]*\s+(?:изображени|кадр)|пиксел|мегапиксел|(?:вертикальн|горизонтальн|квадратн)[а-я]*\s+(?:кадр|формат|ориентац|изображени)/iu.test(
      text,
    )
  ) {
    throw new StudioError(
      "В промпте не должно быть формата, пропорций или разрешения изображения. Уберите эти указания перед сохранением или публикацией.",
    );
  }
}
export function composeReusableIdea(
  idea: any,
  context: CreativeContext | undefined,
  language: string,
) {
  if (!idea || typeof idea !== "object")
    throw new StudioError("ИИ вернул некорректную идею.", 502);
  validateReusablePrompt(`${idea.title || ""} ${idea.concept || ""}`);
  if (!context?.profile.useCharacter) {
    validateReusablePrompt(idea.content);
    validateReusablePrompt(idea.imagePrompt);
    return idea;
  }
  const recipe = idea.recipe;
  if (!recipe || typeof recipe !== "object")
    throw new StudioError(
      "ИИ не проработал образ и сцену. Подборка не отправлена на генерацию изображений.",
      502,
    );
  for (const key of RECIPE_FIELDS) {
    if (
      typeof recipe[key] !== "string" ||
      recipe[key].trim().length < (key === "wardrobe" ? 90 : 40) ||
      recipe[key].length > 2500
    )
      throw new StudioError(
        "ИИ вернул недостаточно подробные одежду, образ или сцену. Измените пожелания и запустите новую подборку.",
        502,
      );
  }
  const body = RECIPE_FIELDS.map((key) => recipe[key].trim()).join("\n");
  const name = context.profile.characterName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  if (
    name.length > 1 &&
    !["героиня", "персонаж", "модель", "character", "model"].includes(
      context.profile.characterName.toLowerCase(),
    ) &&
    new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "iu").test(
      `${idea.title} ${idea.concept} ${body}`,
    )
  )
    throw new StudioError(
      "ИИ включил личное имя персонажа в публичный промпт. Измените пожелания и запустите подборку заново.",
      502,
    );
  validateReusablePrompt(body);
  if (
    /\b(?:blond[e]?|brunette|black|brown|red)\s+hair\b|\b(?:blue|green|brown|hazel|gray)\s+eyes\b|(?:голуб|зел[её]н|кар|сер)[а-я]*\s+глаз|(?:белокож|смуглокож|светлокож)|\b\d{1,2}[- ]?(?:year[- ]old|летн[а-я]*|лет)\b/iu.test(
      body,
    )
  )
    throw new StudioError(
      "Описание внешности привязано к конкретному человеку. Промпт должен сохранять внешность любого референса.",
      502,
    );
  const labels =
    language === "ru"
      ? [
          "Одежда и аксессуары",
          "Образ",
          "Поза и выражение",
          "Сцена",
          "Свет",
          "Камера и композиция",
          "Текстуры и обработка",
        ]
      : [
          "Outfit and accessories",
          "Styling",
          "Pose and expression",
          "Scene",
          "Lighting",
          "Camera and composition",
          "Textures and finish",
        ];
  const identity =
    language === "ru"
      ? "Используй человека из приложенной фотографии как единственный референс внешности. Сохрани узнаваемое лицо, черты, оттенок кожи, цвет волос и естественные пропорции. Не подменяй человека другой моделью. Одежду, позу и окружение создай по описанию ниже."
      : "Use the person in the uploaded photograph as the sole identity reference. Preserve their recognizable face, facial features, skin tone, hair color and natural proportions. Do not substitute a different model. Create the outfit, pose and surroundings described below.";
  const scene = RECIPE_FIELDS.map(
    (key, i) => `${labels[i]}: ${recipe[key].trim()}`,
  ).join("\n\n");
  const content = `${identity}\n\n${scene}`;
  const imagePrompt = context.hasCharacterReference
    ? content
    : `Create an example image with an adult woman. Character guidance for this private preview: ${context.profile.characterDescription}.\n\n${scene}`;
  return { ...idea, content, imagePrompt };
}
