import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShortPromptTitle, isShortPromptTitle, resolvePromptTitle } from "../src/utils/shortPromptTitle";
import { buildShortPromptTitle as browserTitle } from "../../miniapp/src/utils/shortPromptTitle";
import { getPromptLabel } from "../../miniapp/src/utils/promptTitle";

const cases = [
  ["Use my reference photo. Preserve identity. Create a tropical beach portrait under palm trees.", "Тропический отдых"],
  ["Use my reference photo. Preserve identity. Create a portrait in a billiards club.", "Портрет у бильярда"],
  ["Create a portrait standing on a subway platform. No logo, no text, no watermark.", "Портрет в метро"],
  ["Create a portrait with headphones. Do not add a horse, a yacht or a beach.", "Портрет в наушниках"],
  ["Create a luxury yacht portrait at sunset.", "Закат на яхте"],
  ["Создай портрет девушки на яхте на закате. Не меняй лицо.", "Закат на яхте"],
  ["Женщина собирает мандарины в саду. Без логотипа и надписей.", "Мандариновый сад"],
  ["Рекламная съемка: парящая косметика в студии.", "Парящая косметика"],
  ["Create a professional logo for a bakery. No portrait, no beach.", "Дизайн логотипа"],
  ["Напиши Telegram bot для бронирования встреч", "Телеграм бот"],
  ["Create a React dashboard for task management", "Интерфейс приложения"],
  ["Create a beautiful view of a bridge", "Новый промпт"],
  ["", "Новый промпт"]
] as const;

for (const [content, expected] of cases) {
  test(`local title: ${expected} (${content.slice(0, 32)})`, () => {
    assert.equal(buildShortPromptTitle(content), expected);
    assert.equal(browserTitle(content), expected, "The browser and server must generate the same title");
    assert.ok(isShortPromptTitle(expected));
    assert.ok(expected.split(/\s+/).length >= 2 && expected.split(/\s+/).length <= 3);
  });
}

test("meaning comes from the whole prompt, not the same introductory instruction", () => {
  const prefix = "Use my reference photo and preserve identity. ".repeat(100);
  assert.equal(buildShortPromptTitle(prefix + "Scene: tropical beach with palm trees."), "Тропический отдых");
  assert.equal(buildShortPromptTitle(prefix + "Scene: professional billiards club."), "Портрет у бильярда");
});

test("cards prefer a saved short title even when full text or excerpt is present", () => {
  assert.equal(getPromptLabel({ title: "Тропический отдых", contentExcerpt: "Use my reference photo and preserve identity." }), "Тропический отдых");
  assert.equal(resolvePromptTitle({ title: "Авторское название", content: "A portrait on a beach" }), "Авторское название");
  assert.equal(resolvePromptTitle({ title: "Create a portrait", content: "A portrait on a beach under palm trees" }), "Тропический отдых");
  assert.equal(isShortPromptTitle("Use my reference"), false);
  assert.equal(isShortPromptTitle("Создай красивый портрет"), false);
});
