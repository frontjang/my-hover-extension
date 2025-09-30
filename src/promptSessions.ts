import { ProviderSelection } from './ai/types';

export interface PromptDebugSession {
  provider: ProviderSelection;
  endpoint?: string;
  model?: string;
  hoveredWord: string;
  lineText?: string;
  systemPrompt?: string;
  userPrompt: string;
  renderedPrompt: string;
  requestPayload: string;
  responseText?: string;
  responseError?: string;
  timestamp: number;
}

let lastSession: PromptDebugSession | undefined;

export function recordPromptSession(session: PromptDebugSession): void {
  lastSession = session;
}

export function getLastPromptSession(): PromptDebugSession | undefined {
  return lastSession;
}
