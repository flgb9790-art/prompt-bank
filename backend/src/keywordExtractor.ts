const stopWordsRu = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
  "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
  "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
  "даже", "ну", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас",
  "это", "эти", "этот", "эта", "эту", "чтобы", "который", "которая", "которые", "которое",
  "для", "при", "под", "над", "без", "либо", "также", "очень", "можно", "нужно", "надо",
  "сделай", "создай", "напиши", "сгенерируй", "используй", "добавь", "сделать", "создать",
  "промпт", "текст", "пример", "описание", "стиль", "формат", "через", "после", "перед",
  "где", "тут", "там", "здесь", "будет", "была", "было", "есть", "были", "более", "менее"
]);

const stopWordsEn = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is",
  "it", "its", "of", "on", "that", "the", "to", "was", "were", "will", "with", "this", "your",
  "you", "or", "if", "then", "than", "into", "over", "under", "about", "very", "can", "could",
  "should", "would", "we", "they", "their", "our", "my", "me", "i", "please", "make", "create",
  "generate", "write", "text", "prompt", "example", "using", "use", "add", "based"
]);

const thematicKeywords = [
  "beauty", "portrait", "face", "lips", "skin", "studio", "luxury", "glamour", "cosmetology",
  "filler", "botox", "video", "camera", "dolly", "cinematic", "kling", "image", "photo", "logo",
  "branding", "landing", "telegram", "bot", "cursor", "codex", "react", "website", "sketchbook",
  "anime", "chibi", "realistic", "photorealistic", "product", "ads", "marketing",
  "косметология", "косметолог", "портрет", "лицо", "кожа", "видео", "изображение", "фото",
  "телеграм", "бот", "лендинг", "логотип", "маркетинг", "реклама", "брендинг", "айдентика"
];

const maxKeywords = 8;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

function tokenize(text: string): string[] {
  const cleaned = normalizeText(text)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}#-]/gu, " ");

  return cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractHashtags(text: string): string[] {
  const matches = normalizeText(text).match(/#([\p{L}\p{N}_-]{2,32})/gu);
  if (!matches) return [];
  return matches.map((tag) => tag.slice(1));
}

function isCyrillicWord(word: string): boolean {
  return /^[а-яе]+$/u.test(word);
}

function isLatinWord(word: string): boolean {
  return /^[a-z]+$/u.test(word);
}

function shouldSkipToken(token: string): boolean {
  if (!token) return true;
  if (token.length > 40) return true;
  if (/^\d+$/u.test(token)) return true;
  return stopWordsRu.has(token) || stopWordsEn.has(token);
}

function isValidKeyword(token: string): boolean {
  if (shouldSkipToken(token)) return false;
  if (isCyrillicWord(token)) return token.length >= 4;
  if (isLatinWord(token)) return token.length >= 3;
  return false;
}

/** Prefer longer words; drop short fragments that are prefixes of stronger candidates. */
function dedupeKeywords(words: string[]): string[] {
  const sorted = [...new Set(words)].sort((a, b) => b.length - a.length);
  const kept: string[] = [];

  for (const word of sorted) {
    const dominated = kept.some((existing) => {
      if (existing === word) return true;
      if (existing.startsWith(word) && existing.length - word.length >= 2) return true;
      if (word.startsWith(existing) && word.length - existing.length >= 2) return false;
      return false;
    });
    if (!dominated) {
      kept.push(word);
    }
  }

  return kept;
}

export function extractKeywords(text: string, title?: string): string[] {
  const content = text.trim();
  const titleText = title?.trim() ?? "";
  if (!content && !titleText) return [];

  const combined = `${titleText}\n${content}`;
  const source = normalizeText(combined);
  const score = new Map<string, number>();

  const addToken = (raw: string, weight: number) => {
    const token = normalizeText(raw);
    if (!isValidKeyword(token)) return;
    score.set(token, (score.get(token) ?? 0) + weight);
  };

  for (const tag of extractHashtags(combined)) {
    addToken(tag, 6);
  }

  for (const token of tokenize(titleText)) {
    addToken(token, 5);
  }

  for (const token of tokenize(content)) {
    addToken(token, 2);
  }

  for (const topic of thematicKeywords) {
    if (source.includes(topic)) {
      addToken(topic, 4);
    }
  }

  const ranked = dedupeKeywords(
    [...score.entries()]
      .filter(([, value]) => value >= 3)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
      .map(([word]) => word)
  );

  return ranked.slice(0, maxKeywords);
}
