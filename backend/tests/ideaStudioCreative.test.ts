import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import express from "express";
import { once } from "node:events";
import {
  creativeProfile,
  DEFAULT_CREATIVE_PROFILE,
  createCreativeContext,
  studioCalendar,
  creativeResearchTopics,
} from "../src/services/ideaStudio.creative";
import {
  composeReusableIdea,
  validateReusablePrompt,
} from "../src/services/ideaStudio.quality";
import {
  storeStudioReference,
  readStudioReference,
  studioReferencePath,
  rejectPrivateUploadPaths,
} from "../src/services/ideaStudio.references";
import { generateStudioImage } from "../src/services/ideaStudio.openai";
import { config } from "../src/config";
const originalFetch = global.fetch;
const originalKey = config.openaiApiKey;
after(() => {
  global.fetch = originalFetch;
  config.openaiApiKey = originalKey;
});
export const recipe = {
  wardrobe:
    "A tailored camel wool coat worn open over an ivory satin blouse, high-waisted taupe trousers with a precise crease, pointed leather ankle boots, a structured dark brown leather shoulder bag and small gold hoop earrings.",
  styling:
    "Natural polished makeup, subtle warm blush and softly groomed hair that keeps the reference hair color and length.",
  poseExpression:
    "Standing in a relaxed three-quarter pose, one hand in a trouser pocket and the other holding the bag strap, looking calmly toward the camera.",
  scene:
    "A quiet Parisian hotel entrance with pale limestone walls, a brass door and a dark vintage car parked softly out of focus behind the subject.",
  lighting:
    "Soft overcast autumn daylight from the left, gentle shadows, natural reflections and warm interior light through the doorway.",
  cameraComposition:
    "Eye-level editorial photograph, subject slightly off center, enough space to see the complete outfit, soft background separation and a restrained perspective.",
  finish:
    "Natural skin texture, visible wool fibers and realistic satin highlights, elegant warm color grading with subtle contrast and no excessive retouching.",
};
test("default profile focuses on luxury and adult female lifestyle", () => {
  const profile = creativeProfile({});
  assert.equal(profile.primaryTheme, "luxury");
  assert.equal(profile.useCharacter, true);
  assert.ok(profile.extraThemes.includes("travel"));
  assert.throws(
    () => creativeProfile({ primaryTheme: "__proto__" }),
    /тематики/,
  );
});
test("calendar correctly handles hemispheres and year boundary", () => {
  const north = studioCalendar(
    new Date("2026-12-29T22:00:00Z"),
    "Europe/Minsk",
    creativeProfile({}),
  );
  assert.equal(north.date, "2026-12-30");
  assert.equal(north.season, "зима");
  assert.ok(north.upcomingOccasions.some((h) => h.date === "2027-01-01"));
  const south = studioCalendar(
    new Date("2026-07-01T12:00:00Z"),
    "Europe/Minsk",
    creativeProfile({ hemisphere: "south" }),
  );
  assert.equal(south.season, "зима");
  const off = studioCalendar(
    new Date(),
    "Europe/Minsk",
    creativeProfile({ seasonal: false, holidays: false }),
  );
  assert.equal(off.season, null);
  assert.deepEqual(off.upcomingOccasions, []);
});
test("research context includes topics and calendar but excludes private character details", () => {
  const context = createCreativeContext(
    creativeProfile({
      characterName: "PrivateName",
      characterDescription: "Private appearance notes",
    }),
    true,
    "Europe/Minsk",
  );
  const topics = creativeResearchTopics("fashion", context);
  assert.match(topics, /fashion/);
  assert.match(topics, /primary/);
  assert.ok(!topics.includes("PrivateName"));
  assert.ok(!topics.includes("Private appearance notes"));
});
test("public prompts are complete and reusable while private previews may use character guidance", () => {
  const context = createCreativeContext(
    creativeProfile({
      characterName: "PrivateName",
      characterDescription: "Private preview guidance",
    }),
    true,
    "Europe/Minsk",
  );
  const result = composeReusableIdea({ recipe }, context, "en");
  assert.match(result.content, /sole identity reference/);
  assert.match(result.content, /camel wool coat/);
  assert.match(result.content, /gold hoop earrings/);
  assert.match(result.content, /Pose and expression:/);
  assert.match(result.content, /Camera and composition:/);
  assert.ok(!result.content.includes("PrivateName"));
  assert.ok(!result.content.includes("Private preview guidance"));
  assert.equal(result.imagePrompt, result.content);
  const withoutRef = composeReusableIdea(
    { recipe },
    { ...context, hasCharacterReference: false },
    "en",
  );
  assert.match(withoutRef.imagePrompt, /Private preview guidance/);
  assert.ok(!withoutRef.content.includes("Private preview guidance"));
});
test("output formats and fixed appearance cannot enter reusable prompts", () => {
  for (const value of [
    "portrait, 9:16",
    "--ar 2:3",
    "8K quality",
    "resolution 2048",
    "соотношение сторон 4:5",
    "вертикальный кадр",
    "image format png",
  ]) {
    assert.throws(() => validateReusablePrompt(value), /формат/);
  }
  assert.doesNotThrow(() =>
    validateReusablePrompt(
      "85mm lens look, soft f/1.8 depth of field, full body with shoes visible",
    ),
  );
  const context = createCreativeContext(
    DEFAULT_CREATIVE_PROFILE,
    true,
    "Europe/Minsk",
  );
  assert.throws(
    () =>
      composeReusableIdea(
        {
          recipe: {
            ...recipe,
            styling: recipe.styling + " Blonde hair and blue eyes.",
          },
        },
        context,
        "en",
      ),
    /внешности/,
  );
  assert.throws(
    () =>
      composeReusableIdea(
        { recipe: { ...recipe, wardrobe: "A coat" } },
        context,
        "en",
      ),
    /подробные/,
  );
});
test("reference is normalized to JPEG, unsafe keys and fake image files are rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "prompt-bank-reference-"));
  try {
    const png = await sharp({
      create: { width: 80, height: 120, channels: 3, background: "#9988aa" },
    })
      .png()
      .toBuffer();
    const key = await storeStudioReference(png, root);
    const stored = await readStudioReference(key, root);
    assert.equal((await sharp(stored).metadata()).format, "jpeg");
    assert.ok(studioReferencePath(key, root).startsWith(root));
    assert.throws(
      () => studioReferencePath("../secrets.jpg", root),
      /не найден/,
    );
    await assert.rejects(
      () =>
        storeStudioReference(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
          root,
        ),
      /прочитать/,
    );
    await assert.rejects(
      () => storeStudioReference(Buffer.alloc(10 * 1024 * 1024 + 1), root),
      /10 МБ/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("reference image bytes are sent to edits; no reference uses generations", async () => {
  config.openaiApiKey = "test-key";
  const calls: Array<{ url: string; body: any }> = [];
  let reservations = 0;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(
      JSON.stringify({
        data: [{ b64_json: Buffer.alloc(200, 1).toString("base64") }],
      }),
    );
  };
  const reference = Buffer.from("private-photo-test");
  await generateStudioImage(
    "scene",
    "42",
    async () => {
      reservations++;
    },
    new AbortController().signal,
    reference,
  );
  assert.ok(calls[0].url.endsWith("/images/edits"));
  assert.equal(
    calls[0].body.images[0].image_url,
    `data:image/jpeg;base64,${reference.toString("base64")}`,
  );
  assert.equal(calls[0].body.input_fidelity, undefined);
  await generateStudioImage(
    "scene",
    "42",
    async () => {
      reservations++;
    },
    new AbortController().signal,
  );
  assert.ok(calls[1].url.endsWith("/images/generations"));
  assert.equal(calls[1].body.images, undefined);
  assert.equal(reservations, 2);
});
test("private uploads are denied including encoded dot directories", async () => {
  const app = express();
  app.use("/uploads", rejectPrivateUploadPaths, (_req, res) =>
    res.send("public"),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as any).port;
    for (const p of [
      "/.studio-references/test.jpg",
      "/%2Estudio-references/test.jpg",
      "/images/%2Ehidden/test.jpg",
    ]) {
      assert.equal(
        (await originalFetch(`http://127.0.0.1:${port}/uploads${p}`)).status,
        404,
      );
    }
    assert.equal(
      (
        await originalFetch(
          `http://127.0.0.1:${port}/uploads/images/public.jpg`,
        )
      ).status,
      200,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});
