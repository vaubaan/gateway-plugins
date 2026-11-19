// Checks a built plugin folder before the release job signs it, without running any of its
// code and with no dependency:
//
//   node scripts/verify-built.mjs <dir> <id> <version>
//
// The folder came out of a build job that ran the plugin's own code (its bundle is imported
// to smoke-test it), so nothing in it is trusted: the manifest must name the declared id and
// version, every file must be listed in the manifest with its sha256, every listed file must
// be there, and nothing else may sit beside them (no signature planted by the build).
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MANIFEST = 'vaubaan-manifest.json';
const FORMAT = 'vaubaan-plugin-manifest/v1';

/** Every regular file under `dir`, as `/`-separated paths; a link or a device is a problem. */
function filesUnder(dir, problems, root = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isDirectory()) out.push(...filesUnder(full, problems, root));
    else if (stat.isFile()) out.push(relative(root, full).split(sep).join('/'));
    else problems.push(`${relative(root, full)}: not a regular file`);
  }
  return out;
}

/** The problems of the built folder `dir` for the declaration `id` `version`. */
export function verifyBuilt(dir, id, version) {
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'));
  } catch (err) {
    return [`${MANIFEST}: unreadable (${err instanceof Error ? err.message : String(err)})`];
  }
  if (manifest === null || typeof manifest !== 'object') return [`${MANIFEST}: not an object`];
  if (manifest.format !== FORMAT) problems.push(`${MANIFEST}: format is not ${FORMAT}`);
  if (manifest.id !== id) problems.push(`${MANIFEST}: id ${manifest.id}, declared ${id}`);
  if (manifest.version !== version) {
    problems.push(`${MANIFEST}: version ${manifest.version}, declared ${version}`);
  }
  const listed = manifest.files;
  if (listed === null || typeof listed !== 'object' || Array.isArray(listed)) {
    return [...problems, `${MANIFEST}: no files`];
  }
  const present = new Set(filesUnder(dir, problems));
  for (const path of present) {
    if (path === MANIFEST) continue;
    if (!Object.hasOwn(listed, path)) {
      problems.push(`${path}: not in the manifest`);
      continue;
    }
    const digest = createHash('sha256')
      .update(readFileSync(join(dir, path)))
      .digest('hex');
    if (digest !== listed[path]) problems.push(`${path}: its sha256 is not the manifest's`);
  }
  for (const path of Object.keys(listed)) {
    if (!present.has(path)) problems.push(`${path}: in the manifest, missing from the folder`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, id, version] = process.argv.slice(2);
  if (!dir || !id || !version) {
    console.error('usage: node scripts/verify-built.mjs <dir> <id> <version>');
    process.exitCode = 2;
  } else {
    const problems = verifyBuilt(dir, id, version);
    for (const problem of problems) console.error(problem);
    process.exitCode = problems.length === 0 ? 0 : 1;
  }
}
