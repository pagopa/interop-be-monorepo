import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('./dashboard.sh', import.meta.url).pathname;

test('prepare mounts the source checkout and isolates every workspace dependency directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'interop dashboard '));
  try {
    const backend = path.join(root, 'backend');
    const frontend = path.join(root, 'frontend');
    await mkdir(path.join(backend, 'packages', 'a-worker'), { recursive: true });
    await mkdir(path.join(backend, 'packages', 'b-api'), { recursive: true });
    await mkdir(frontend);
    await writeFile(path.join(backend, 'packages', 'a-worker', 'package.json'), '{}');
    await writeFile(path.join(backend, 'packages', 'b-api', 'package.json'), '{}');
    const prepare = (args = [], environment = {}) => spawnSync('bash', [script, 'prepare', ...args], {
      env: { ...process.env, INTEROP_BE_ROOT: backend, DASHBOARD_AUTOSTART_PRESET: '', ...environment }, encoding: 'utf8',
    });
    const first = prepare();
    assert.equal(first.status, 0, first.stderr);
    const file = path.join(backend, '.local-development', 'dashboard', 'compose.yml');
    const backendOnly = JSON.parse(await readFile(file, 'utf8'));
    const runtime = backendOnly.services.dashboard;
    assert.equal(runtime.working_dir, backend);
    assert.ok(!('DASHBOARD_MODE' in runtime.environment));
    assert.ok(!('DASHBOARD_AUTOSTART_PRESET' in runtime.environment));
    assert.equal(runtime.volumes.find((v) => v.type === 'bind').source, backend);
    for (const directory of ['node_modules', 'packages/a-worker/node_modules', 'packages/b-api/node_modules']) {
      const mount = runtime.volumes.find((v) => v.target === path.join(backend, directory));
      assert.equal(mount.type, 'volume');
      assert.equal(mount.volume.nocopy, true);
    }
    const second = prepare(['--frontend', frontend]);
    assert.equal(second.status, 0, second.stderr);
    const fullstack = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(!('DASHBOARD_MODE' in fullstack.services.dashboard.environment));
    assert.ok(!('DASHBOARD_AUTOSTART_PRESET' in fullstack.services.dashboard.environment));
    assert.equal(fullstack.services.dashboard.environment.INTEROP_FE_ROOT, frontend);
    assert.ok(fullstack.services.dashboard.volumes.some((v) => v.source === frontend));
    assert.ok(fullstack.services.dashboard.ports.some((p) => p.target === 5173 && p.published === '3000'));
    assert.ok(!fullstack.services.dashboard.ports.some((p) => p.target === 3000 && p.published === '3000'));
    assert.ok(fullstack.services.dashboard.ports.some((p) => p.target === 3000 && p.published === '13000'));
    assert.ok(fullstack.services.dashboard.ports.some((p) => p.target === 4700 && p.published === '4700' && p.host_ip === '127.0.0.1'));
    const repeated = prepare(['--frontend', frontend]);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), fullstack);
    const selected = prepare(['--frontend', frontend, '--preset', 'frontend-full']);
    assert.equal(selected.status, 0, selected.stderr);
    const startup = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(startup.services.dashboard.environment.DASHBOARD_AUTOSTART_PRESET, 'frontend-full');
    assert.ok(!('DASHBOARD_MODE' in startup.services.dashboard.environment));
    const fromEnvironment = prepare([], {
      DASHBOARD_AUTOSTART_PRESET: 'tenant-seeding',
      DASHBOARD_AUTOSTART: 'false',
    });
    assert.equal(fromEnvironment.status, 0, fromEnvironment.stderr);
    const configured = JSON.parse(await readFile(file, 'utf8')).services.dashboard;
    assert.equal(configured.environment.DASHBOARD_AUTOSTART_PRESET, 'tenant-seeding');
    assert.equal(configured.environment.DASHBOARD_AUTOSTART, 'false');
    assert.equal(configured.environment.INTEROP_FE_ROOT, '');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('infra operations target infrastructure and preserve the dashboard during reset', async () => {
  const scriptPath = new URL('./dashboard-infra.sh', import.meta.url).pathname;
  const root = await mkdtemp(path.join(tmpdir(), 'interop-infra-test-'));
  try {
    const calls = path.join(root, 'calls');
    const fakeDocker = path.join(root, 'docker');
    await writeFile(fakeDocker, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$TEST_CALLS"
case "$*" in
  *'config --services'*) printf 'event-store\\nselfcare-mock\\ndashboard\\n' ;;
  *'config --format json'*) printf '%s' '{"name":"pagopa-interop","volumes":{"event-store-data":{"name":"pagopa-interop_event-store-data"}},"services":{"event-store":{"volumes":[{"type":"volume","source":"event-store-data"}]},"dashboard":{"volumes":[{"type":"volume","source":"modules"}]}}}' ;;
esac
`, { mode: 0o755 });
    for (const action of ['start', 'stop', 'reset']) {
      const result = spawnSync('bash', [scriptPath, action], {
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, TEST_CALLS: calls }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    }
    const commands = (await readFile(calls, 'utf8')).split('\n');
    const mutations = commands.filter((c) => /\b(up|stop|rm|volume rm)\b/.test(c));
    assert.ok(mutations.some((c) => c.includes('up -d event-store selfcare-mock')));
    assert.ok(mutations.every((c) => !/\bdashboard\b/.test(c)));
    assert.ok(mutations.every((c) => !/\bdown\b|--remove-orphans|modules/.test(c)));
    assert.ok(mutations.some((c) => c.includes('volume rm pagopa-interop_event-store-data')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
