// Trava dos comandos proibidos para quem instala o plugin (permissions.deny do .claude/settings.json nao viaja com ele).
// Mantenha esta lista igual a do .claude/settings.json deste repositorio.
import { readFileSync } from 'node:fs';

const DENY = [
  'git rebase', 'git reset', 'git restore', 'git clean', 'git revert', 'git stash drop', 'git branch -D',
  'git commit --amend', 'git push --force', 'git push -f', 'git switch -f', 'git switch --discard-changes',
  'git checkout -f', 'git checkout -- ', 'git add -A', 'git add --all', 'git add -u',
];
const DENY_RE = [
  /^git add \.$/,
  /^git push .*(--force|\s-f$)/,
  /^git (commit|push) .*--no-verify/,
];

const input = JSON.parse(readFileSync(0, 'utf8'));
const block = (reason) => {
  console.error(reason);
  process.exit(2);
};

if (input.tool_name.endsWith('executeDestructive')) block('Operacao destrutiva na Atlassian bloqueada pelo plugin multi-agent.');

// Cada parte de um comando encadeado (&&, ||, ;, |) e conferida separadamente.
for (const part of String(input.tool_input?.command ?? '').split(/&&|\|\||;|\|/)) {
  const cmd = part.trim();
  if (DENY.some((p) => cmd.startsWith(p)) || DENY_RE.some((re) => re.test(cmd))) {
    block(`Comando bloqueado pelo plugin multi-agent: ${cmd}`);
  }
}
