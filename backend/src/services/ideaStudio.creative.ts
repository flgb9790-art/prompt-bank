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
    ? "Используй приложенное фото взрослой девушки как референс личности. Сохрани её лицо, черты, оттенок кожи и узнаваемую внешность. Меняй место, одежду, позу и свет в соответствии со сценой; не заменяй персонажа другим человеком."
    : "Use the attached photo of the adult woman as the identity reference. Preserve her face, facial features, skin tone and recognizable appearance. Change the setting, outfit, pose and lighting to match the scene; do not replace her with another person.";
}
