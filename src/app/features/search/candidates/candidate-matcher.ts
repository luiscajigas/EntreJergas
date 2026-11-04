import { normalizeExpression } from '../../../shared/normalize-expression';
import { Candidate } from './candidate.protocol';

interface VocabularyEntry extends Candidate {
  normalized: string;
}

const vocabulary: VocabularyEntry[] = [
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

const maxCandidates = 4;
const minTokenLength = 3;

/** Función pura: no conoce el worker, así que se puede probar en el hilo principal. */
export function findCandidates(text: string): Candidate[] {
  const normalized = normalizeExpression(text);
  if (!normalized) return [];
  const tokens = normalized.split(' ');

  return vocabulary
    .map((entry) => {
      const exactPhrase = normalized.includes(entry.normalized);
      const partialWord = entry.normalized.split(' ').some((word) =>
        tokens.some((token) => token.length >= minTokenLength && word.startsWith(token))
      );
      return { entry, matches: exactPhrase || partialWord, rank: exactPhrase ? 0 : 1 };
    })
    .filter(({ matches }) => matches)
    .sort((left, right) => left.rank - right.rank || left.entry.expression.localeCompare(right.entry.expression))
    .slice(0, maxCandidates)
    .map(({ entry: { expression, region } }) => ({ expression, region }));
}
