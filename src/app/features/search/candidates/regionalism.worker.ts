/// <reference lib="webworker" />
import { findCandidates } from './candidate-matcher';
import { CandidateRequest, CandidateResponse } from './candidate.protocol';

const debounceMs = 280;
let pending: ReturnType<typeof setTimeout> | undefined;

function respond(response: CandidateResponse): void {
  postMessage(response);
}

addEventListener('message', ({ data }: MessageEvent<CandidateRequest>) => {
  clearTimeout(pending);
  if (!data.text.trim()) {
    respond({ id: data.id, candidates: [] });
    return;
  }
  pending = setTimeout(() => respond({ id: data.id, candidates: findCandidates(data.text) }), debounceMs);
});
