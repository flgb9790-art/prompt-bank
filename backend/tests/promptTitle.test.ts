import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildShortPromptTitle, detectPromptLanguage, isShortPromptTitle, resolvePromptTitle } from "../src/utils/shortPromptTitle";
import { buildShortPromptTitle as browserTitle, resolvePromptTitle as browserResolve } from "../../miniapp/src/utils/shortPromptTitle";
import { derivePromptTitle as serverPreview } from "../src/utils/promptTitle";
import { derivePromptTitle as browserPreview, getPromptLabel } from "../../miniapp/src/utils/promptTitle";

const cases = [
  ["Use my reference photo. Preserve identity. Create a tropical beach portrait under palm trees.", "Tropical Escape"],
  ["Use my reference photo. Preserve identity. Create a portrait in a billiards club.", "Billiards Portrait"],
  ["Create a portrait standing on a subway platform. No logo, no text, no watermark.", "Subway Portrait"],
  ["Create a portrait with headphones. Do not add a horse, a yacht or a beach.", "Headphones Portrait"],
  ["Create a luxury yacht portrait at sunset.", "Yacht Sunset"],
  ["Создай портрет девушки на яхте на закате. Не меняй лицо.", "Закат на яхте"],
  ["Женщина собирает мандарины в саду. Без логотипа и надписей.", "Мандариновый сад"],
  ["Рекламная съемка: парящая косметика в студии.", "Парящая косметика"],
  ["Create a professional logo for a bakery. No portrait, no beach.", "Logo Design"],
  ["Напиши Telegram bot для бронирования встреч", "Телеграм бот"],
  ["Create a React dashboard for task management", "App Interface"],
  ["Создай фотографию желтого Ferrari возле дома на тихой улице.", "Жёлтая Феррари"],
  ["Создай интерфейс на React для управления записями через Telegram bot, добавь комментарии на русском языке.", "Телеграм бот"],
  ["Create a bioluminescent crystal cave with luminous stones.", "Bioluminescent crystal cave"],
  ["Создай голографический лес будущего с прозрачными растениями.", "Голографический лес будущего"],
  ["Crée une forêt enchantée avec des lucioles sous les arbres.", "Forêt enchantée lucioles"],
  ["Un bosque encantado con luces violetas y árboles antiguos.", "Bosque encantado luces"],
  ["Crée un portrait dans le métro avec une lumière douce.", "Portrait métro lumière"],
  ["Створи портрет дівчини на яхті під час заходу сонця.", "Створи портрет дівчини"],
  ["", "Новый промпт"]
] as const;

for (const [content, expected] of cases) {
  test("local title: " + expected + " (" + content.slice(0, 32) + ")", () => {
    assert.equal(buildShortPromptTitle(content), expected);
    assert.equal(browserTitle(content), expected, "The browser and server must generate the same title");
    assert.equal(serverPreview(content), expected);
    assert.equal(browserPreview(content), expected);
    assert.ok(isShortPromptTitle(expected));
    assert.ok(expected.split(/\s+/u).length >= 2 && expected.split(/\s+/u).length <= 3);
  });
}

test("a repeated English reference introduction cannot override the Russian scene", () => {
  const prefix = "Use my reference photo and preserve identity. Keep the same person from the reference. ".repeat(100);
  const content = prefix + "Создай портрет девушки на яхте на закате, добавь мягкий свет, спокойное море и естественные цвета.";
  assert.equal(detectPromptLanguage(content), "ru");
  assert.equal(buildShortPromptTitle(content), "Закат на яхте");
  assert.equal(browserTitle(content), "Закат на яхте");
});

test("a Russian reference introduction cannot override the English scene", () => {
  const prefix = "Используйте референсное фото. Сохраните лицо и личность. ".repeat(100);
  const content = prefix + "Create a portrait on a tropical beach with palm trees and warm light. The woman wears a white dress and stands near the ocean.";
  assert.equal(detectPromptLanguage(content), "en");
  assert.equal(buildShortPromptTitle(content), "Tropical Escape");
});

test("the predominant body language wins over a short opening in another language", () => {
  assert.equal(buildShortPromptTitle("Create a portrait. Девушка стоит на платформе метро рядом с поездом. Свет мягкий, кожа естественная, одежда повседневная, камера расположена на уровне глаз."), "Портрет в метро");
  assert.equal(buildShortPromptTitle("Портрет девушки. Create an image of a woman on a yacht at sunset. She stands beside the railing and watches the ocean with a calm expression."), "Yacht Sunset");
});

test("brand names and links cannot turn Russian prose into English", () => {
  const content = "Напиши Telegram bot для записи клиентов. Интеграции: React, Cursor, ChatGPT, OpenAI, Pinterest, Instagram, YouTube, TikTok. Добавь выбор времени и подтверждение записи. https://example.com/english/yacht/beach";
  assert.equal(detectPromptLanguage(content), "ru");
  assert.equal(buildShortPromptTitle(content), "Телеграм бот");
});

test("negative sections and inline exclusions cannot supply a title theme or change its language", () => {
  const en = "Create a studio portrait of a woman without a horse or a yacht.\nNegative prompt:\nbeach, Ferrari, pyramids, winter, dragon";
  const ru = "Создай студийный портрет девушки.\nНегативный промпт:\nhorse, yacht, beach, Ferrari, dragon, winter";
  assert.equal(buildShortPromptTitle(en), "Studio Portrait");
  assert.equal(buildShortPromptTitle(ru), "Студийный портрет");
  assert.equal(buildShortPromptTitle("Create a logo for a bakery, no portrait, beach or yacht."), "Logo Design");
  assert.equal(buildShortPromptTitle("Do not add a horse, a yacht or a beach."), "Image Constraints");
  assert.equal(buildShortPromptTitle("Не добавляй лошадь, яхту или пляж."), "Ограничения изображения");
});

test("languages without spaces and short foreign phrases retain their source script", () => {
  for (const content of ["绘制未来城市霓虹夜景", "미래도시", "Bonjour"]) {
    assert.equal(buildShortPromptTitle(content), content);
    assert.equal(browserTitle(content), content);
    assert.ok(!/[а-яё]/iu.test(buildShortPromptTitle(content)));
    assert.notEqual(buildShortPromptTitle(content), "New Prompt");
  }
});

test("known legacy automatic titles resolve in the full prompt language without changing stored content", () => {
  const content = "Create a luxury yacht portrait at sunset.";
  const prompt = { title: "Закат на яхте", content };
  assert.equal(resolvePromptTitle(prompt), "Yacht Sunset");
  assert.equal(browserResolve(prompt), "Yacht Sunset");
  assert.deepEqual(prompt, { title: "Закат на яхте", content });
  assert.equal(resolvePromptTitle({ title: "Tropical Escape", content: "Создай портрет на пляже под тропическими пальмами." }), "Тропический отдых");
  assert.equal(resolvePromptTitle({ title: "Новый промпт", content: "Create a bioluminescent crystal cave." }), "Bioluminescent crystal cave");
});

test("unknown authored short titles are preserved even in a different language", () => {
  for (const title of ["Авторское название", "My Quiet Universe", "Личная история", "История о далёком будущем", "Ностальгия"]) {
    const prompt = { title, content: "Create a portrait on a beach under palm trees." };
    assert.equal(resolvePromptTitle(prompt), title);
    assert.equal(browserResolve(prompt), title);
    assert.equal(getPromptLabel(prompt), title);
  }
  assert.equal(resolvePromptTitle({ title: "Create a portrait", content: "Create a portrait on a tropical beach with palm trees." }), "Tropical Escape");
  assert.equal(isShortPromptTitle("Use my reference"), false);
  assert.equal(isShortPromptTitle("Создай красивый портрет"), false);
});

test("cards trust the API title when the excerpt contains only an introduction in another language", () => {
  assert.equal(getPromptLabel({ title: "Yacht Sunset", contentExcerpt: "Используйте референсное фото и сохраните лицо." }), "Yacht Sunset");
  assert.equal(getPromptLabel({ title: "Закат на яхте", contentExcerpt: "Use my reference photo and preserve identity." }), "Закат на яхте");
  assert.equal(getPromptLabel({ title: "Закат на яхте", content: "Create a luxury yacht portrait at sunset.", contentExcerpt: "Используйте референсное фото." }), "Yacht Sunset");
});

test("all automatic themes have bilingual short titles and browser code stays identical", () => {
  const serverSource = readFileSync(path.resolve(__dirname, "../src/utils/shortPromptTitle.ts"), "utf8");
  const browserSource = readFileSync(path.resolve(__dirname, "../../miniapp/src/utils/shortPromptTitle.ts"), "utf8");
  assert.equal(browserSource, serverSource);
  const titles = [...serverSource.matchAll(/theme\("([^"]+)"/gu)].map(match => match[1]);
  assert.ok(titles.length >= 100);
  for (const title of titles) {
    const english = resolvePromptTitle({ title, content: "Create an image of a woman in a scene with soft lighting." });
    assert.ok(!/[а-яё]/iu.test(english), "Missing English title for " + title);
    assert.ok(isShortPromptTitle(title), title);
    assert.ok(isShortPromptTitle(english), english);
    assert.equal(browserResolve({ title, content: "Create an image of a woman in a scene with soft lighting." }), english);
  }
});
