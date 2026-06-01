import { api } from "../api";
import type { BootstrapResponse } from "../types";

const BOOTSTRAP_PROMPTS_LIMIT = 1;

let bootstrapPromise: Promise<BootstrapResponse> | null = null;

export function fetchWebBootstrapOnce(): Promise<BootstrapResponse> {
  if (!bootstrapPromise) {
    bootstrapPromise = api.bootstrap(BOOTSTRAP_PROMPTS_LIMIT);
  }
  return bootstrapPromise;
}
