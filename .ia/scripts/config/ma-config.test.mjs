import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from './ma-config.mjs';

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ma-config-'));
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}
const done = (dir) => rmSync(dir, { recursive: true, force: true });

test('sem nada: padroes, stack indefinida', () => {
  const d = repo({});
  const c = readConfig(d);
  assert.equal(c.source, 'defaults');
  assert.equal(c.src, 'src/app');
  assert.equal(c.out, 'dist/app');
  assert.equal(c.stack, null);
  assert.equal(c.stackSource, 'indefinida');
  assert.deepEqual(c.errors, []);
  done(d);
});

test('chave multiAgent do package.json vence o arquivo de configuracao', () => {
  const d = repo({
    'package.json': { multiAgent: { stack: 'vanilla', src: 'site', out: 'public' }, scripts: { build: 'x', sass: 'y' } },
    'multi-agent.config.json': { stack: 'angular', src: 'outra', out: 'saida' },
  });
  const c = readConfig(d);
  assert.equal(c.source, 'package.json');
  assert.equal(c.src, 'site');
  assert.equal(c.out, 'public');
  assert.equal(c.stack, 'vanilla');
  assert.equal(c.stackSource, 'config');
  assert.deepEqual(c.scripts, { build: true, sass: true });
  done(d);
});

test('fallback: multi-agent.config.json quando o package.json nao tem a chave', () => {
  const d = repo({ 'package.json': { name: 'x' }, 'multi-agent.config.json': { stack: 'vanilla', out: 'build/site' } });
  const c = readConfig(d);
  assert.equal(c.source, 'multi-agent.config.json');
  assert.equal(c.out, 'build/site');
  assert.equal(c.src, 'src/app');
  assert.deepEqual(c.scripts, { build: false, sass: false });
  done(d);
});

test('fallback funciona sem package.json (projeto sem Node)', () => {
  const d = repo({ 'multi-agent.config.json': { stack: 'vanilla' } });
  const c = readConfig(d);
  assert.equal(c.source, 'multi-agent.config.json');
  assert.deepEqual(c.errors, []);
  done(d);
});

test('detecta angular por @angular/core e le a versao', () => {
  const d = repo({ 'package.json': { dependencies: { '@angular/core': '^21.1.0' } } });
  const c = readConfig(d);
  assert.equal(c.stack, 'angular');
  assert.equal(c.stackSource, 'detectada');
  assert.equal(c.angularVersion, 21);
  done(d);
});

test('detecta angular por angular.json', () => {
  const d = repo({ 'angular.json': {} });
  assert.equal(readConfig(d).stack, 'angular');
  done(d);
});

test('detecta vanilla por src/app/index.html', () => {
  const d = repo({ 'src/app/index.html': '<html></html>' });
  const c = readConfig(d);
  assert.equal(c.stack, 'vanilla');
  assert.equal(c.stackSource, 'detectada');
  done(d);
});

test('detecta vanilla usando o src configurado', () => {
  const d = repo({ 'package.json': { multiAgent: { src: 'site' } }, 'site/index.html': '<html></html>' });
  assert.equal(readConfig(d).stack, 'vanilla');
  done(d);
});

test('stack configurada vence a deteccao', () => {
  const d = repo({ 'package.json': { multiAgent: { stack: 'vanilla' }, dependencies: { '@angular/core': '21.0.0' } } });
  const c = readConfig(d);
  assert.equal(c.stack, 'vanilla');
  assert.equal(c.stackSource, 'config');
  done(d);
});

test('invalidos: stack desconhecida, caminho absoluto, fora do repo e src igual a out', () => {
  const cases = [
    { stack: 'react' },
    { src: '/etc' },
    { out: '../fora' },
    { src: 'a', out: 'a' },
    { src: '.' },
  ];
  for (const multiAgent of cases) {
    const d = repo({ 'package.json': { multiAgent } });
    assert.ok(readConfig(d).errors.length > 0, JSON.stringify(multiAgent));
    done(d);
  }
});

test('JSON quebrado vira erro, nao excecao', () => {
  const d = repo({ 'package.json': '{ quebrado' });
  const c = readConfig(d);
  assert.equal(c.errors.length, 1);
  assert.equal(c.source, 'defaults');
  done(d);
});
