export function normalizeTagName(tag: string): string {
  return tag.trim().toLowerCase().replace(/^#+/, "");
}

export function promptHasTag(prompt: { keywords: Array<{ keyword: { name: string } }> }, tag: string): boolean {
  const normalized = normalizeTagName(tag);
  if (!normalized) return false;
  return prompt.keywords.some((item) => normalizeTagName(item.keyword.name) === normalized);
}
