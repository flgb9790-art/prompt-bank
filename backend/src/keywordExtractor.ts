const stopWordsRu = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
  "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
  "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
  "даже", "ну", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас",
  "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может"
]);

const stopWordsEn = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is",
  "it", "its", "of", "on", "that", "the", "to", "was", "were", "will", "with", "this", "your",
  "you", "or", "if", "then", "than", "into", "over", "under", "about", "very", "can", "could",
  "should", "would", "we", "they", "their", "our", "my", "me", "i"
]);

const thematicKeywords = [
  "beauty", "portrait", "face", "lips", "skin", "studio", "luxury", "glamour", "cosmetology",
  "filler", "botox", "video", "camera", "dolly", "cinematic", "kling", "image", "photo", "logo",
  "branding", "landing", "telegram", "bot", "cursor", "codex", "react", "website", "sketchbook",
  "anime", "chibi", "realistic", "photorealistic", "product", "ads", "marketing"
];

const minTokenLength = 3;

export function extractKeywords(text: string): string[] {
  if (!text.trim()) {
    return [];
  }

  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= minTokenLength)
    .filter((token) => !stopWordsRu.has(token) && !stopWordsEn.has(token));

  const frequency = new Map<string, number>();
  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  const thematicHits = thematicKeywords.filter((kw) => normalized.includes(kw));
  const freqKeywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  const merged = [...new Set([...thematicHits, ...freqKeywords])];
  const maxKeywords = 12;
  const minKeywords = 5;

  if (merged.length < minKeywords) {
    const fallback = thematicKeywords.filter((word) => freqKeywords.includes(word));
    merged.push(...fallback);
  }

  return merged.slice(0, Math.max(minKeywords, Math.min(maxKeywords, merged.length)));
}
