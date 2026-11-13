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
  identityInstruction,
  characterImagePrompt,
  characterShotPlan,
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
import { generateStudioImage, generateStudioTexts, researchStudioIdeas, responseText } from "../src/services/ideaStudio.openai";
import { config } from "../src/config";
import { studioPhotoInstruction } from "../src/services/ideaStudio.realism";
import { similarIdea, ideaComparisonText } from "../src/services/ideaStudio.validation";
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
  assert.match(result.content, /apparent age/);
  assert.match(result.content, /head rotation or tilt/);
  assert.match(result.content, /photorealistic professional photography/);
  assert.match(result.content, /scene-appropriate lens perspective/);
  const withoutRef = composeReusableIdea(
    { recipe },
    { ...context, hasCharacterReference: false },
    "en",
  );
  assert.match(withoutRef.imagePrompt, /Private preview guidance/);
  assert.match(withoutRef.imagePrompt, /photorealistic professional photography/);
  assert.ok(!withoutRef.content.includes("Private preview guidance"));
});
test("identity-only guidance preserves apparent age while freeing head, expression and body pose", () => {
  const oldDraft = "Use the person in the uploaded photograph as the sole identity reference. Keep their natural proportions.\n\nPose: seated sideways, head turned left, looking down toward a book.";
  const prompt = characterImagePrompt(oldDraft, "en");
  assert.match(prompt, /Do not age or de-age/);
  assert.match(prompt, /does not define the pose, body position, head rotation or tilt, gaze, expression/);
  assert.match(prompt, /Pose: seated sideways, head turned left/);
  assert.match(prompt, /independently staged photograph/);
  assert.match(prompt, /locally straightened, cropped identity sample/);
  assert.match(prompt, /head upright with no lateral roll/);
  assert.match(prompt, /scene explicitly names its direction or shoulder/);
  assert.match(prompt, /Disregard requests.*copy the reference pose/);
  assert.equal(prompt.match(/sole identity reference/g)?.length, 1);
  assert.ok(!prompt.includes("Keep their natural proportions"));
  const russian = characterImagePrompt("Поза: идёт по улице, голова повёрнута влево.", "ru");
  assert.match(russian, /видимый возраст/);
  assert.match(russian, /поворот или наклон головы/);
  assert.match(russian, /Поза: идёт по улице/);
  validateReusablePrompt(identityInstruction("en"));
  validateReusablePrompt(identityInstruction("ru"));
});

test("ten-character staging plans vary pose and head direction without changing identity", () => {
  const plan = characterShotPlan(10, "batch-A");
  assert.equal(plan.length, 10);
  assert.equal(new Set(plan.map(item => item.direction)).size, 10);
  assert.deepEqual(plan.map(item => item.idea), [1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(plan, characterShotPlan(10, "batch-A"));
  assert.ok(plan.every(item => /head/.test(item.direction)));
  assert.ok(plan.some(item => /Seated/.test(item.direction)));
  assert.ok(plan.some(item => /Walking/.test(item.direction)));
  assert.ok(plan.some(item => /profile/.test(item.direction)));
  assert.equal(characterShotPlan(1, "batch-B").length, 1);
});

test("text requests carry the pose plan and age guidance, while rewrites keep the user's staging request", async () => {
  config.openaiApiKey = "test-key";
  const requests: any[] = [];
  global.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ ideas: [] }) }] }],
    }));
  };
  const input = {
    count: 10, topics: "Lifestyle", language: "en", previous: [], shotSeed: "batch-A",
    creativeContext: createCreativeContext(creativeProfile({}), true, "Europe/Minsk"),
  };
  let reservations = 0;
  const reserve = async () => { reservations++; };
  await generateStudioTexts(input, reserve, new AbortController().signal);
  const brief = JSON.parse(requests[0].input);
  assert.match(requests[0].instructions,/Photographic treatment overrides/);
  assert.match(brief.photographicTreatment,/photorealistic professional photography/);
  assert.deepEqual(brief.shotDirections, characterShotPlan(10, "batch-A"));
  assert.match(brief.characterDirectionRequirements, /never as a pose, styling or composition template/);
  assert.match(brief.characterDirectionRequirements, /without aging or de-aging/);
  assert.match(brief.characterDirectionRequirements, /head yaw/);
  await generateStudioTexts({...input, count: 1, sourcePrompt: "Seated, head turned toward a window"}, reserve, new AbortController().signal);
  const rewrite = JSON.parse(requests[1].input);
  assert.equal(rewrite.shotDirections, undefined);
  assert.equal(rewrite.sourcePrompt, "Seated, head turned toward a window");
  assert.equal(reservations, 2);
});

test("unfinished research reuses found sources once without using truncated text or retrying", async () => {
  config.openaiApiKey = "test-key";
  const calls: any[] = [];
  global.fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({
      status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
      output: [
        { type: "web_search_call", status: "completed", action: { sources: [{title:"Fashion exhibit",url:"https://example.test/exhibit"}] } },
        { type: "message", content: [{ type: "output_text", text: "UNFINISHED AND UNVERIFIED SUMMARY" }] },
      ],
    }));
  };
  let reservations = 0;
  const result = await researchStudioIdeas("fashion", async()=>{reservations++;}, new AbortController().signal);
  assert.equal(calls.length, 1);
  assert.equal(reservations, 1);
  assert.equal(calls[0].max_output_tokens, 10000);
  assert.match(calls[0].instructions,/Exclude fantasy concepts/);
  assert.match(calls[0].instructions, /at most 450 words/);
  assert.equal(result.sources[0].url, "https://example.test/exhibit");
  assert.match(result.notice!, /не завершил сводку/);
  assert.ok(!result.text.includes("UNFINISHED AND UNVERIFIED SUMMARY"));
  assert.match(result.text, /not verified excerpts/);
});

test("research without sources or blocked content stops with a specific error and never retries", async () => {
  config.openaiApiKey = "test-key";
  for (const [reason, pattern] of [["max_output_tokens", /лимит длины ответа/], ["content_filter", /ограничений содержимого/]] as const) {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({
        status: "incomplete", incomplete_details: { reason },
        output: reason === "content_filter" ? [{type:"web_search_call",status:"completed",action:{sources:[{title:"Title",url:"https://example.test/"}]}}] : [],
      }));
    };
    await assert.rejects(()=>researchStudioIdeas("fashion",async()=>{},new AbortController().signal),pattern);
    assert.equal(calls, 1);
  }
});

test("unfinished response diagnostics keep only safe status and token metadata", () => {
  const originalWarn = console.warn;
  const logs: unknown[][] = [];
  console.warn = (...args)=>{logs.push(args);};
  try {
    assert.throws(()=>responseText({
      status:"incomplete",incomplete_details:{reason:"max_output_tokens",private:"do-not-log"},
      usage:{output_tokens:2800,output_tokens_details:{reasoning_tokens:2700}},
      output:[{type:"message",content:[{type:"output_text",text:"do-not-log"}]}],
      error:{message:"do-not-log"},
    }, "research"), /Это не сообщение о балансе/);
    assert.equal((logs[0][1] as any).reason, "max_output_tokens");
    assert.equal((logs[0][1] as any).reasoningTokens, 2700);
    assert.ok(!JSON.stringify(logs).includes("do-not-log"));
    assert.throws(()=>responseText({status:"incomplete",incomplete_details:{reason:"do-not-log"},output:[]}),/не завершил/);
    assert.equal((logs[1][1] as any).reason, "unknown");
  } finally { console.warn = originalWarn; }
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
  assert.match(calls[0].body.prompt,/photorealistic professional photography/);
  assert.match(calls[0].body.prompt,/cannot override the photographic treatment/);
  assert.match(calls[0].body.prompt,/Preserve reference identity and apparent age/);
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
  assert.match(calls[1].body.prompt,/physically plausible surroundings/i);
  assert.match(calls[1].body.prompt,/SCENE BRIEF:\nscene/);
  assert.equal(reservations, 2);
});

test("photographic treatment is bilingual, reusable and does not make different scenes duplicates",()=>{
  const first="A ceramic bowl rests on a wooden table beside a linen napkin in a sunlit kitchen.";
  const second="A cyclist repairs a bicycle beside a brick workshop with a wrench and spare wheel.";
  for(const language of ["en","ru"]){
    const rule=studioPhotoInstruction(language);
    validateReusablePrompt(rule);
    const a=composeReusableIdea({title:"Table Study",concept:first,content:first,imagePrompt:first},undefined,language);
    const b=composeReusableIdea({title:"Cycle Workshop",concept:second,content:second,imagePrompt:second},undefined,language);
    assert.equal(a.content,`${rule}\n\n${first}`);
    assert.equal(a.imagePrompt,a.content);
    assert.equal(ideaComparisonText(a.content),first);
    assert.equal(similarIdea(a.content,b.content),false);
  }
  assert.match(studioPhotoInstruction("ru"),/настоящей камерой/);
  assert.match(studioPhotoInstruction(),/Natural skin/);
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
