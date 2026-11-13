export type IdeaStudioSettings = {
  dailyEnabled: boolean;
  dailyCount: number;
  runAt: string;
  timeZone: string;
  language: string;
  topics: string;
  useWebSearch: boolean;
};
export type IdeaStudioDraft = {
  id: string;
  batchId: string;
  title: string;
  concept: string;
  content: string;
  imagePrompt: string;
  theme: string;
  visualStyle: string;
  selected: boolean;
  rejected: boolean;
  imageUrl: string | null;
  imageStatus: string;
  imageError: string | null;
  imageStale: boolean;
  busyJobId: string | null;
  publishError: string | null;
  publishUncertain: boolean;
  promptId: number | null;
  prompt: {
    id: number;
    telegramPostUrl: string | null;
    pinterestPublished: boolean;
  } | null;
};
export type IdeaStudioBatch = {
  id: string;
  status: string;
  count: number;
  createdAt: string;
  topics: string;
  error: string | null;
  sources: Array<{ url: string; title: string }>;
  drafts: IdeaStudioDraft[];
};
export type IdeaStudioJob = {
  id: string;
  kind: string;
  status: string;
  completed: number;
  total: number;
  error: string | null;
  createdAt: string;
};
export type IdeaStudioOverview = {
  configured: boolean;
  models: { text: string; image: string; imageQuality: string };
  settings: IdeaStudioSettings;
  limits: { image: number; text: number; resetTimeZone: string };
  usage: { image: number; text: number };
  batches: Array<Omit<IdeaStudioBatch, "drafts">>;
  jobs: IdeaStudioJob[];
  current: IdeaStudioBatch | null;
};
