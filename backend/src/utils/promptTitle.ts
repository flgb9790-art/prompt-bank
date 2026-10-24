import { buildShortPromptTitle } from "./shortPromptTitle";

export function derivePromptTitle(content: string): string {
  return buildShortPromptTitle(content);
}
