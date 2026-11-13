import { fingerprint, ideaComparisonText, StudioError } from "./ideaStudio.validation";

export type StudioHistoryIdea = { title: string; concept?: string; content?: string };
export function compactStudioHistory(rows: StudioHistoryIdea[]) {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const scene = ideaComparisonText(row.content || row.concept || "");
    const key = fingerprint(scene || row.title);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{title: row.title.slice(0,100), concept: (row.concept || "").slice(0,300), scene: scene.slice(0,650)}];
  });
}
// Review every historical scene, partitioning large libraries rather than
// silently dropping older drafts. Each partition is a distinct, metered check.
export function studioHistoryChunks<T>(rows: T[], maxCharacters = 48000): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [], size = 2;
  for (const row of rows) {
    const length = JSON.stringify(row).length + 1;
    if (current.length && size + length > maxCharacters) {
      chunks.push(current); current = []; size = 2;
    }
    current.push(row); size += length;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[]];
}
export function acceptedNoveltyCandidates(value: any, expected: number[]) {
  const decisions = value?.decisions;
  if (!Array.isArray(decisions) || decisions.length !== expected.length)
    throw new StudioError("Проверка новизны вернула неполный результат. Изображения не создавались; повторите вручную.", 502);
  const allowed = new Set(expected), seen = new Set<number>(), accepted: number[] = [];
  for (const item of decisions) {
    if (!item || !Number.isInteger(item.candidate) || !allowed.has(item.candidate) || seen.has(item.candidate) || !["new","repeat","excluded"].includes(item.decision))
      throw new StudioError("Не удалось проверить новизну идей. Изображения не создавались; повторите вручную.", 502);
    seen.add(item.candidate);
    if (item.decision === "new") accepted.push(item.candidate);
  }
  return expected.filter(id => accepted.includes(id));
}
