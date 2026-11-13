export type StudioCreativeProfile = {
  useCharacter: boolean;
  characterName: string;
  characterDescription: string;
  primaryTheme: string;
  extraThemes: string[];
  seasonal: boolean;
  holidays: boolean;
  region: string;
  hemisphere: "north" | "south";
};
export type IdeaStudioSettings = {
  creativeProfile: StudioCreativeProfile;
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
  hasReference: boolean;
  creativeContext?: {
    profile: StudioCreativeProfile;
    hasCharacterReference: boolean;
    calendar: {
      date: string;
      region: string;
      season: string | null;
      upcomingOccasions: Array<{ name: string; date: string }>;
    };
  };
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
  reference: { available: boolean; version: string | null };
  configured: boolean;
  models: { text: string; image: string; imageQuality: string };
  settings: IdeaStudioSettings;
  limits: { image: number; text: number; resetTimeZone: string };
  usage: { image: number; text: number };
  batches: Array<Omit<IdeaStudioBatch, "drafts">>;
  jobs: IdeaStudioJob[];
  current: IdeaStudioBatch | null;
};
