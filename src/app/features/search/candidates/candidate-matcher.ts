import { normalizeExpression } from '../../../shared/normalize-expression';
import { Candidate } from './candidate.protocol';

const vocabulary = (
  [
    { expression: 'parcero', region: 'Antioquia' },
    { expression: 'parce', region: 'Antioquia' },
    { expression: 'qué chimba', region: 'Antioquia' },
    { expression: 'chimba', region: 'Antioquia' },
    { expression: 'bacano', region: 'Caribe y región Andina' },
    { expression: 'chévere', region: 'Caribe' },
    { expression: 'berraco', region: 'Santander' },
    { expression: 'camellar', region: 'Colombia' },
    { expression: 'guayabo', region: 'Colombia' },
    { expression: 'vaina', region: 'Caribe y región Andina' },
    { expression: 'paila', region: 'Colombia' },
    { expression: 'tinto', region: 'Colombia' },
    { expression: 'mamar gallo', region: 'Caribe colombiano' },
    { expression: 'dar papaya', region: 'Colombia' },
    { expression: 'rumba', region: 'Caribe y Colombia' },
    { expression: 'chichai', region: 'Por confirmar' },
    { expression: 'boludo', region: 'Argentina y Uruguay' },
    { expression: 'che', region: 'Argentina y Uruguay' },
    { expression: 'pibe', region: 'Argentina y Uruguay' },
    { expression: 'güey', region: 'México' },
    { expression: 'chido', region: 'México' },
    { expression: 'la neta', region: 'México' },
    { expression: 'chamo', region: 'Venezuela' },
    { expression: 'pana', region: 'Venezuela, Ecuador y Panamá' },
    { expression: 'weón', region: 'Chile' },
    { expression: 'cachai', region: 'Chile' },
    { expression: 'tío', region: 'España' },
    { expression: 'guay', region: 'España' },
    { expression: 'pura vida', region: 'Costa Rica' },
    { expression: 'mae', region: 'Costa Rica' },
    { expression: 'asere', region: 'Cuba' }
  ] satisfies Candidate[]
).map((entry) => ({ ...entry, normalized: normalizeExpression(entry.expression) }));

const maxCandidates = 4;
const minTokenLength = 3;

/** Función pura: no conoce el worker, así que se puede probar en el hilo principal. */
export function findCandidates(text: string): Candidate[] {
  const normalized = normalizeExpression(text);
  if (!normalized) return [];
  const tokens = normalized.split(' ');
  const words = ` ${normalized} `;

  return vocabulary
    .map((entry) => {
      // Palabra completa: "noche" contiene "che", pero no la está mencionando.
      const exactPhrase = words.includes(` ${entry.normalized} `);
      const partialWord = entry.normalized
        .split(' ')
        .some((word) =>
          tokens.some((token) => token.length >= minTokenLength && word.startsWith(token))
        );
      return { entry, matches: exactPhrase || partialWord, rank: exactPhrase ? 0 : 1 };
    })
    .filter(({ matches }) => matches)
    .sort(
      (left, right) =>
        left.rank - right.rank || left.entry.expression.localeCompare(right.entry.expression)
    )
    .slice(0, maxCandidates)
    .map(({ entry: { expression, region } }) => ({ expression, region }));
}
