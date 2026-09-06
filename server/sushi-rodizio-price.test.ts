import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const rodizio = JSON.parse(fs.readFileSync('scripts/sushi-rodizio-20260906.json', 'utf8')).items[0];

describe('Rodízio Sushi', () => {
  it('mantém preço cheio em R$ 149,90 e meio prato em 60%', () => {
    expect(rodizio.preco).toBe(149.9);
    expect(rodizio.permiteMeioPrato).toBe(true);
    expect(rodizio.servePara2).toBe(false);
    expect(Math.round(rodizio.preco * 0.60 * 100) / 100).toBe(89.94);
  });
});
