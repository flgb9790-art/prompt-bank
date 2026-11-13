import { createHash } from "node:crypto";
import {
  localStudioClock,
  StudioError,
  studioString,
} from "./ideaStudio.validation";

export const STUDIO_THEMES = {
  luxury:
    "Роскошная жизнь: дорогие отели, виллы, яхты, fine dining, автомобили, private jet, quiet luxury",
  travel:
    "Путешествия: разные города, страны, курорты и культурные впечатления",
  fashion:
    "Мода: editorial, street style, вечерние образы, продуманные сезонные наряды",
  everyday:
    "Повседневность: кафе, утренние ритуалы, прогулки, домашний уют и работа",
  wellness: "Wellness: спорт, spa, йога, здоровый отдых и забота о себе",
  cinematic: "Кино и фантазия: выразительные сцены и необычные истории",
  nature: "Природа: горы, море, сады, лес и загородная жизнь",
} as const;
export type CreativeProfile = {
  useCharacter: boolean;
  characterName: string;
  characterDescription: string;
  primaryTheme: keyof typeof STUDIO_THEMES;
  extraThemes: Array<keyof typeof STUDIO_THEMES>;
  seasonal: boolean;
  holidays: boolean;
  region: string;
  hemisphere: "north" | "south";
};
export const DEFAULT_CREATIVE_PROFILE: CreativeProfile = {
  useCharacter: true,
  characterName: "Героиня",
  characterDescription:
    "Взрослая девушка. Естественная внешность, современный стиль и разные жизненные ситуации.",
  primaryTheme: "luxury",
  extraThemes: ["travel", "fashion", "wellness"],
  seasonal: true,
  holidays: true,
  region: "Беларусь, Европа",
  hemisphere: "north",
};
export function creativeProfile(value: unknown): CreativeProfile {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new StudioError("Некорректные настройки персонажа.");
  const p = { ...DEFAULT_CREATIVE_PROFILE, ...value };
  for (const field of ["useCharacter", "seasonal", "holidays"] as const)
    if (typeof p[field] !== "boolean")
      throw new StudioError("Некорректные настройки персонажа и календаря.");
  if (
    !Object.hasOwn(STUDIO_THEMES, p.primaryTheme) ||
    !Array.isArray(p.extraThemes) ||
    p.extraThemes.length > 6 ||
    p.extraThemes.some(
      (key) => typeof key !== "string" || !Object.hasOwn(STUDIO_THEMES, key),
    )
  )
    throw new StudioError("Выберите тематики из списка.");
  if (!["north", "south"].includes(p.hemisphere))
    throw new StudioError("Выберите полушарие.");
  return {
    ...p,
    characterName: studioString(p.characterName, "Имя персонажа", 1, 80),
    characterDescription: studioString(
      p.characterDescription,
      "Описание персонажа",
      3,
      1500,
    ),
    region: studioString(p.region, "Регион", 2, 150),
    extraThemes: [...new Set(p.extraThemes)].filter(
      (key) => key !== p.primaryTheme,
    ),
  } as CreativeProfile;
}
export function studioCalendar(
  date: Date,
  timeZone: string,
  profile: CreativeProfile,
) {
  const local = localStudioClock(date, timeZone).date;
  const [year, month, day] = local.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 12));
  const seasonIndex =
    (Math.floor((month % 12) / 3) + (profile.hemisphere === "south" ? 2 : 0)) %
    4;
  const seasons = ["зима", "весна", "лето", "осень"];
  const occasions = [
    { month: 1, day: 1, name: "Новый год" },
    { month: 1, day: 7, name: "Рождество 7 января (если уместно для региона)" },
    { month: 2, day: 14, name: "День святого Валентина" },
    { month: 3, day: 8, name: "Международный женский день" },
    { month: 10, day: 31, name: "Хэллоуин (если уместно для региона)" },
    {
      month: 12,
      day: 25,
      name: "Рождество 25 декабря (если уместно для региона)",
    },
    { month: 12, day: 31, name: "Канун Нового года" },
  ];
  const upcoming = profile.holidays
    ? [year, year + 1]
        .flatMap((y) =>
          occasions.map((o) => ({
            ...o,
            date: new Date(Date.UTC(y, o.month - 1, o.day, 12)),
          })),
        )
        .filter(
          (o) =>
            o.date >= start &&
            o.date.getTime() - start.getTime() <= 45 * 86400000,
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((o) => ({ name: o.name, date: o.date.toISOString().slice(0, 10) }))
    : [];
  return {
    date: local,
    timeZone,
    region: profile.region,
    hemisphere: profile.hemisphere,
    season: profile.seasonal ? seasons[seasonIndex] : null,
    upcomingOccasions: upcoming,
    notes:
      "Календарные поводы — идеи для съёмки, не официальный календарь выходных. Подвижные праздники и региональную уместность проверять по источникам; сезон места путешествия может отличаться.",
  };
}
export function createCreativeContext(
  profile: CreativeProfile,
  hasReference: boolean,
  timeZone: string,
  date = new Date(),
) {
  return {
    profile,
    hasCharacterReference: profile.useCharacter && hasReference,
    calendar: studioCalendar(date, timeZone, profile),
  };
}
export type CreativeContext = ReturnType<typeof createCreativeContext>;
export function readCreativeContext(
  value: unknown,
): CreativeContext | undefined {
  const context = value as CreativeContext | null;
  return context?.profile && context?.calendar ? context : undefined;
}
export function creativeResearchTopics(
  topics: string,
  context?: CreativeContext,
) {
  if (!context) return topics;
  const p = context.profile;
  // Never send the character's name, description or reference photo to web search.
  return JSON.stringify({
    additionalTopics: topics,
    subject: p.useCharacter
      ? "Adult woman lifestyle photography"
      : "Creative image concepts",
    primary: STUDIO_THEMES[p.primaryTheme],
    extra: p.extraThemes.map((key) => STUDIO_THEMES[key]),
    calendar: context.calendar,
    request:
      "Find original photographic situations, seasonal activities and culturally relevant upcoming occasions. Mostly explore the primary theme; vary locations, activities, outfits and composition.",
  });
}
export function identityInstruction(language: string) {
  return language === "ru"
    ? "Используй человека из приложенной фотографии как единственный референс внешности. Сохрани узнаваемое лицо, черты и пропорции лица, видимый возраст, оттенок кожи и цвет волос. Не делай человека старше или моложе, не добавляй морщины и не усиливай возрастные признаки. Референс не задаёт позу, положение тела, поворот или наклон головы, направление взгляда, выражение лица, одежду, фон, освещение или композицию. Создай новую фотографию: поставь человека в позу и ракурс из описания ниже, естественно поверни голову и измени выражение лица по сцене. Не копируй геометрию исходного кадра и не вклеивай неподвижное лицо. Одежду и окружение создай по описанию."
    : "Use the person in the uploaded photograph as the sole identity reference. Preserve their recognizable face, facial features and facial proportions, apparent age, skin tone and hair color. Do not age or de-age the person, add wrinkles or exaggerate age-related features. The reference does not define the pose, body position, head rotation or tilt, gaze, expression, outfit, background, lighting or composition. Create a new photograph: pose the person and choose the viewpoint described below, naturally rotate their head and change their expression to fit the scene. Do not copy the source frame geometry or paste an immobile face into it. Create the outfit and surroundings from the description.";
}

export function characterImagePrompt(scene: string, language: string) {
  // Old drafts may contain our earlier, less precise identity paragraph.
  const description = scene.replace(
    /^(?:Use the person in the uploaded photograph|Используй человека из приложенной фотографии)[\s\S]*?\n\n/u,
    "",
  );
  return language === "ru"
    ? `${identityInstruction(language)}\n\nНОВАЯ СЦЕНА:\n${description}\n\nПриоритеты: фото задаёт только внешность и видимый возраст; текст сцены задаёт позу тела, положение и наклон головы, взгляд, мимику, камеру и образ. Если в описании есть просьба скопировать позу, ракурс или выражение из референса либо изменить возраст, не выполняй эту просьбу. Создай самостоятельный кадр, не вариант исходной фотографии. Сохрани естественную кожу без искусственно усиленной резкости, глубоких складок и старящей обработки.`
    : `${identityInstruction(language)}\n\nNEW SCENE:\n${description}\n\nPriorities: the photo controls identity and apparent age only; the scene text controls body pose, head direction and tilt, gaze, expression, camera and styling. Disregard requests in the scene to copy the reference pose, viewpoint or expression, or to change apparent age. Produce an independently staged photograph, not a variation of the source frame. Keep natural skin without exaggerated sharpening, deep creases or aging effects.`;
}

const SHOT_DIRECTIONS = [
  "Walking mid-step, torso at a three-quarter angle, head turned toward the direction of movement, gaze away from the lens.",
  "Seated with a relaxed asymmetrical posture, torso angled sideways, head turned back toward the camera, chin slightly lowered.",
  "Standing in a side-on pose, head in a readable profile, gaze toward an object or view within the scene.",
  "Turning while moving away, head looking back over one shoulder, a spontaneous small smile.",
  "Leaning naturally on a scene-appropriate support, shoulders angled, head gently tilted, gaze directed slightly upward.",
  "Reaching for or using a prop, torso rotated, head lowered toward the hands, a focused expression.",
  "Walking toward the camera, shoulders relaxed, head nearly forward with a small tilt, a lively candid expression.",
  "Seated sideways with one hand resting naturally, head turned toward an off-camera companion, a candid laugh.",
  "Pausing during a natural activity, torso at three-quarter view, head turned to the side with chin gently raised, gaze toward a distant point.",
  "Standing with weight on one leg, torso turned away from the camera, head rotated toward the lens, a calm soft expression.",
];
export function characterShotPlan(count: number, seed: string) {
  const offset = createHash("sha256").update(seed).digest()[0] % SHOT_DIRECTIONS.length;
  return Array.from({ length: Math.min(count, SHOT_DIRECTIONS.length) }, (_, i) => ({
    idea: i + 1,
    direction: SHOT_DIRECTIONS[(offset + i) % SHOT_DIRECTIONS.length],
  }));
}
