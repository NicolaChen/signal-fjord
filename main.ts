import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const source = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shots = readdirSync(join(source, 'screenshots')).filter(name => !name.startsWith('.'));
if (shots.length < 3 || shots.length > 4) throw Error('Deliver three or four browser screenshots.');

mkdirSync(output, { recursive: true });
for (const folder of ['game', 'screenshots']) {
  cpSync(join(source, folder), join(output, folder), { recursive: true });
}
const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
