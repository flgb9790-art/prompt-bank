const stopWordsRu = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
  "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
  "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
  "даже", "ну", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас",
  "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может",
  "это", "эти", "этот", "чтобы", "который", "которая", "которые", "для", "при", "под", "над",
  "без", "или", "либо", "также", "очень", "нужно", "надо", "сделай", "создай", "напиши",
  "промпт", "текст", "пример"
]);

const stopWordsEn = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is",
  "it", "its", "of", "on", "that", "the", "to", "was", "were", "will", "with", "this", "your",
  "you", "or", "if", "then", "than", "into", "over", "under", "about", "very", "can", "could",
  "should", "would", "we", "they", "their", "our", "my", "me", "i", "please", "make", "create",
  "generate", "write", "text", "prompt", "example"
]);

const thematicKeywords = [
  "beauty", "portrait", "face", "lips", "skin", "studio", "luxury", "glamour", "cosmetology",
  "filler", "botox", "video", "camera", "dolly", "cinematic", "kling", "image", "photo", "logo",
  "branding", "landing", "telegram", "bot", "cursor", "codex", "react", "website", "sketchbook",
  "anime", "chibi", "realistic", "photorealistic", "product", "ads", "marketing",
  "косметология", "косметолог", "портрет", "лицо", "кожа", "видео", "изображение", "фото",
  "телеграм", "бот", "лендинг", "логотип", "маркетинг", "реклама"
];

const ruSuffixes = ["иями", "ями", "ами", "иях", "ах", "ия", "ья", "ие", "ые", "ой", "ий", "ый", "ая", "ое", "ые", "ом", "ем", "ам", "ям", "ов", "ев", "ей", "у", "ю", "а", "я", "ы", "и", "о", "е"];
const enSuffixes = ["ingly", "edly", "ing", "ed", "es", "s"];
const minTokenLength = 3;
const maxKeywords = 10;
const minKeywords = 3;

function stemToken(token: string): string {
  let result = token.toLowerCase();
  if (/^[а-яё]+$/iu.test(result) && result.length > 5) {
    for (const suffix of ruSuffixes) {
      if (result.endsWith(suffix) && result.length - suffix.length >= minTokenLength) {
        result = result.slice(0, -suffix.length);
        break;
      }
    }
  } else if (/^[a-z]+$/i.test(result) && result.length > 4) {
    for (const suffix of enSuffixes) {
      if (result.endsWith(suffix) && result.length - suffix.length >= minTokenLength) {
        result = result.slice(0, -suffix.length);
        break;
      }
    }
  }
  return result;
}

function shouldSkipToken(token: string): boolean {
  if (!token) return true;
  if (token.length < minTokenLength || token.length > 32) return true;
  if (/^\d+$/u.test(token)) return true;
  return stopWordsRu.has(token) || stopWordsEn.has(token);
}

export function extractKeywords(text: string): string[] {
  const source = text.trim().toLowerCase();
  if (!source) return [];

  const cleaned = source.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ");
  const rawTokens = cleaned.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const tokens = rawTokens
    .map(stemToken)
    .filter((token) => !shouldSkipToken(token));

  const score = new Map<string, number>();
  for (const token of tokens) {
    score.set(token, (score.get(token) ?? 0) + 2);
  }

  for (const topic of thematicKeywords) {
    if (source.includes(topic)) {
      score.set(topic, (score.get(topic) ?? 0) + 3);
    }
  }

  const ranked = [...score.entries()]
    .filter(([word, value]) => value >= 2 && !shouldSkipToken(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);

  return ranked.slice(0, Math.max(minKeywords, Math.min(maxKeywords, ranked.length)));
}
