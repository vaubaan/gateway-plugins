// The declarations of the catalog (`catalog/<id>.yaml`): read and checked, no dependency.
//
//   node scripts/declarations.mjs check            every declaration, exit 1 on a problem
//   node scripts/declarations.mjs json <id>        one declaration as JSON (for the workflows)
//   node scripts/declarations.mjs changed <base>   the ids whose declaration changed since <base>
//
// A declaration is flat YAML, one `key: value` per line, `owners` a flow list:
//
//   id: crm
//   repo: https://github.com/acme/vaubaan-plugin-crm
//   path: .                       (optional: the plugin's folder in the repository)
//   version: 0.2.0
//   commit: <40 hex>              the exact commit the catalog builds
//   owners: [acme-dev, acme/plugin-team]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG = 'catalog';
const KEYS = ['id', 'repo', 'path', 'version', 'commit', 'owners'];
const REQUIRED = ['id', 'repo', 'version', 'commit', 'owners'];

/** The problems of a declaration's text, and the declaration. Pure. */
export function readDeclaration(text, file) {
  const problems = [];
  const decl = {};
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!match) {
      problems.push(`${file}:${index + 1}: not a "key: value" line`);
      continue;
    }
    const [, key, value] = match;
    if (!KEYS.includes(key)) problems.push(`${file}:${index + 1}: unknown key ${key}`);
    else if (key in decl) problems.push(`${file}:${index + 1}: ${key} twice`);
    else if (key === 'owners') {
      const list = /^\[(.*)\]$/.exec(value.trim());
      decl.owners = list
        ? list[1]
            .split(',')
            .map((owner) => owner.trim())
            .filter((owner) => owner !== '')
        : null;
    } else decl[key] = value.trim().replace(/^'(.*)'$|^"(.*)"$/, '$1$2');
  }
  for (const key of REQUIRED) if (!(key in decl)) problems.push(`${file}: no ${key}`);
  if (decl.id !== undefined && !/^[a-z][a-z0-9-]*$/.test(decl.id)) {
    problems.push(`${file}: id must be a lowercase slug`);
  }
  if (decl.id !== undefined && file !== `${decl.id}.yaml`) {
    problems.push(`${file}: the file is named after its id (${decl.id}.yaml)`);
  }
  if (decl.repo !== undefined && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(decl.repo)) {
    problems.push(`${file}: repo must be https://github.com/<owner>/<repo>`);
  }
  if (decl.path !== undefined && (decl.path.startsWith('/') || decl.path.split('/').includes('..'))) {
    problems.push(`${file}: path must stay inside the repository`);
  }
  if (decl.version !== undefined && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(decl.version)) {
    problems.push(`${file}: version must be semver`);
  }
  if (decl.commit !== undefined && !/^[0-9a-f]{40}$/.test(decl.commit)) {
    problems.push(`${file}: commit must be a full 40-character sha`);
  }
  if (decl.owners === null || (Array.isArray(decl.owners) && decl.owners.length === 0)) {
    problems.push(`${file}: owners must list at least one GitHub user or team`);
  } else if (Array.isArray(decl.owners)) {
    for (const owner of decl.owners) {
      if (!/^[A-Za-z0-9-]+(\/[A-Za-z0-9_.-]+)?$/.test(owner)) {
        problems.push(`${file}: owner '${owner}' is not a GitHub user or org/team`);
      }
    }
  }
  return { problems, declaration: { path: '.', ...decl } };
}

export function allDeclarations(dir = CATALOG) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => ({ file: name, ...readDeclaration(readFileSync(join(dir, name), 'utf8'), name) }));
}

function main(argv) {
  const [command, arg] = argv;
  if (command === 'check') {
    const all = allDeclarations();
    const problems = all.flatMap((d) => d.problems);
    for (const problem of problems) console.error(problem);
    console.log(`${all.length} declarations, ${problems.length} problems`);
    return problems.length === 0 ? 0 : 1;
  }
  if (command === 'json') {
    const found = allDeclarations().find((d) => d.declaration.id === arg);
    if (!found || found.problems.length > 0) {
      console.error(found ? found.problems.join('\n') : `no declaration ${arg}`);
      return 1;
    }
    console.log(JSON.stringify(found.declaration));
    return 0;
  }
  if (command === 'changed') {
    const out = execFileSync('git', ['diff', '--name-only', `${arg}...HEAD`, '--', CATALOG], {
      encoding: 'utf8',
    });
    const ids = out
      .split('\n')
      .filter((path) => path.endsWith('.yaml'))
      .map((path) => path.slice(CATALOG.length + 1, -'.yaml'.length));
    console.log(ids.join('\n'));
    return 0;
  }
  console.error('usage: node scripts/declarations.mjs check | json <id> | changed <base>');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
