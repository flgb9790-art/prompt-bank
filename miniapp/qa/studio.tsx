// Local development fixture. Not part of the production build. All network actions are mocked.
import React from "react";
import { createRoot } from "react-dom/client";
import { api } from "../src/api";
import { IdeaStudioPage } from "../src/pages/IdeaStudioPage";
import { Topbar } from "../src/components/web/Topbar";
import { WebLayout } from "../src/components/web/WebLayout";
import { MobileWebShell } from "../src/components/web/MobileWebShell";
import { useMediaMinWidth } from "../src/hooks/useMediaMinWidth";
import type {
  IdeaStudioDraft,
  IdeaStudioOverview,
} from "../src/ideaStudioTypes";
import "../src/styles.css";
import "../src/studio.css";
const themes = [
  "Still life",
  "Architecture",
  "Nature",
  "Fashion",
  "Surrealism",
  "Portrait",
];
const titles = [
  "Amber Courtyard",
  "Quiet Concrete",
  "Moonlit Garden",
  "Silk In Motion",
  "Floating Horizon",
  "Violet Hour",
];
function poster(i: number) {
  return `http://127.0.0.1:4317/qa/poster.svg?variant=${i}`;
}
const drafts: IdeaStudioDraft[] = titles.map((title, i) => ({
  id: `draft-${i}`,
  batchId: "local-batch",
  title,
  concept: `${themes[i]}: исследование формы, света и пространства. Самостоятельная визуальная идея с точной композицией и необычной цветовой палитрой.`,
  content:
    "Create a refined editorial photograph of an amber glass sculpture in a quiet courtyard. Use soft natural light, precise material textures and generous negative space. The image should feel calm, original and visually balanced. Choose a restrained palette of amber, slate blue and warm concrete.",
  imagePrompt:
    "An amber glass sculpture in a quiet courtyard, soft natural light and a restrained editorial composition.",
  theme: themes[i],
  visualStyle: "Editorial",
  selected: i === 0,
  rejected: false,
  imageUrl: i < 4 ? poster(i) : null,
  imageStatus: i < 4 ? "ready" : i === 4 ? "generating" : "failed",
  imageError: i === 5 ? "Тестовая ошибка изображения: текст сохранён." : null,
  imageStale: false,
  busyJobId: i === 4 ? "fixture-job" : null,
  publishError: null,
  publishUncertain: false,
  promptId: null,
  prompt: null,
}));
const settings = {
  dailyEnabled: false,
  dailyCount: 10,
  runAt: "09:00",
  timeZone: "Europe/Minsk",
  language: "en",
  topics: "Портреты, предметная съёмка, архитектура, мода, природа, сюрреализм",
  useWebSearch: true,
};
const data: IdeaStudioOverview = {
  configured: true,
  models: {
    text: "gpt-5-mini",
    image: "gpt-image-2.5-flare",
    imageQuality: "low",
  },
  settings,
  limits: { image: 10, text: 12, resetTimeZone: "UTC" },
  usage: { image: 6, text: 2 },
  batches: [
    {
      id: "local-batch",
      status: "partial",
      count: 6,
      createdAt: "2026-11-13T07:00:00Z",
      topics: settings.topics,
      error: null,
      sources: [],
    },
  ],
  jobs: [],
  current: {
    id: "local-batch",
    status: "partial",
    count: 6,
    createdAt: "2026-11-13T07:00:00Z",
    topics: settings.topics,
    error: null,
    sources: [],
    drafts,
  },
};
api.ideaStudio = async () => structuredClone(data);
api.pinterestStatus = async () => ({
  connected: true,
  configured: true,
  legacyConfigured: false,
  needsReconnect: false,
  environment: "sandbox",
  boardId: "local",
  boardName: "Local test",
});
api.editIdeaDraft = async (id, input) => {
  Object.assign(drafts.find((d) => d.id === id)!, input);
  return { ok: true };
};
api.saveIdeaStudioSettings = async (input) => {
  Object.assign(settings, input);
  return { ok: true };
};
api.publishIdeaDrafts = async () => {
  throw Error("Локальная проверка: реальная публикация отключена.");
};
api.generateIdeaBatch = async () => {
  throw Error("Локальная проверка: реальные генерации отключены.");
};
api.regenerateIdeaImage = async () => {
  throw Error("Локальная проверка: реальные генерации отключены.");
};
api.rewriteIdeaDraft = async () => {
  throw Error("Локальная проверка: реальные генерации отключены.");
};
function StudioFixture() {
  const desktop = useMediaMinWidth(1024);
  const content = (
    <div className="library-content">
      <IdeaStudioPage />
    </div>
  );
  return desktop ? (
    <WebLayout
      topbar={
        <Topbar
          currentPath="/studio"
          canCreate
          isAuthenticated
          onNavigate={() => undefined}
          onCreatePrompt={() => undefined}
          onFocusSearch={() => undefined}
          onLoginTelegram={() => undefined}
        />
      }
    >
      {content}
    </WebLayout>
  ) : (
    <MobileWebShell
      currentPath="/settings"
      search=""
      onSearchChange={() => undefined}
      onNavigate={() => undefined}
      canCreate
      onCreatePrompt={() => undefined}
      headerRight={null}
    >
      {content}
    </MobileWebShell>
  );
}
createRoot(document.getElementById("root")!).render(<StudioFixture />);
