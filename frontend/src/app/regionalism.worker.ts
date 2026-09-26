interface Candidate {
  expression: string;
  normalized: string;
  region: string;
}

const vocabulary: Candidate[] = [
  { expression: 'parcero', normalized: 'parcero', region: 'Antioquia' },
  { expression: 'parce', normalized: 'parce', region: 'Antioquia' },
  { expression: 'qué chimba', normalized: 'que chimba', region: 'Antioquia' },
  { expression: 'chimba', normalized: 'chimba', region: 'Antioquia' },
  { expression: 'bacano', normalized: 'bacano', region: 'Caribe y región Andina' },
  { expression: 'chévere', normalized: 'chevere', region: 'Caribe' },
  { expression: 'berraco', normalized: 'berraco', region: 'Santander' },
  { expression: 'camellar', normalized: 'camellar', region: 'Colombia' },
  { expression: 'guayabo', normalized: 'guayabo', region: 'Colombia' },
  { expression: 'vaina', normalized: 'vaina', region: 'Caribe y región Andina' },
  { expression: 'paila', normalized: 'paila', region: 'Colombia' },
  { expression: 'tinto', normalized: 'tinto', region: 'Colombia' },
  { expression: 'mamar gallo', normalized: 'mamar gallo', region: 'Caribe colombiano' },
  { expression: 'dar papaya', normalized: 'dar papaya', region: 'Colombia' },
  { expression: 'rumba', normalized: 'rumba', region: 'Caribe y Colombia' },
  { expression: 'chichai', normalized: 'chichai', region: 'Por confirmar' }
];

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

self.onmessage = (event: MessageEvent<string>) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const text = event.data;

  debounceTimer = setTimeout(() => {
    const normalized = normalize(text);
    const tokens = normalized.split(' ');
    const candidates = vocabulary
      .map((candidate) => {
        const exactPhrase = normalized.includes(candidate.normalized);
        const partialWord = candidate.normalized.split(' ').some((word) =>
          tokens.some((token) => token.length >= 3 && word.startsWith(token))
        );
        const exactScore = exactPhrase ? 0 : 1;
        return { candidate, matches: exactPhrase || partialWord, score: exactScore };
      })
      .filter((item) => item.matches)
      .sort((left, right) => left.score - right.score || left.candidate.expression.localeCompare(right.candidate.expression))
      .slice(0, 4)
      .map(({ candidate }) => ({ expression: candidate.expression, region: candidate.region }));

    self.postMessage({ candidates, checking: false });
  }, 280);
};