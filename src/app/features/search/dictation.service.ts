import { DestroyRef, Injectable, inject, signal } from '@angular/core';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: Event & { results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

@Injectable({ providedIn: 'root' })
export class DictationService {
  private readonly Recognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  private recognition?: SpeechRecognitionLike;

  readonly supported = this.Recognition !== undefined;
  readonly listening = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.recognition?.stop());
  }

  toggle(onTranscript: (transcript: string) => void): void {
    if (this.listening()) {
      this.recognition?.stop();
      return;
    }
    if (!this.Recognition) return;

    const recognition = new this.Recognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => onTranscript(event.results[event.results.length - 1][0].transcript);
    recognition.onerror = () => this.listening.set(false);
    recognition.onend = () => this.listening.set(false);
    this.recognition = recognition;
    this.listening.set(true);
    recognition.start();
  }
}
