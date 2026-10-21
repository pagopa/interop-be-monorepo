import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('../dashboard.sh', import.meta.url).pathname;
const entrypoint = new URL('../../../docker/dev-dashboard/entrypoint.sh', import.meta.url).pathname;

for (const { platform, hostUid, hostGid, runtimeUid, runtimeGid } of [
  { platform: 'Darwin', hostUid: '501', hostGid: '20', runtimeUid: '1000', runtimeGid: '1000' },
  { platform: 'Linux', hostUid: '1234', hostGid: '2345', runtimeUid: '1234', runtimeGid: '2345' },
]) {
  test(`prepare selects the runtime identity for ${platform} hosts`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'interop-runtime-identity-'));
    try {
      const commands = path.join(root, 'bin');
      await mkdir(commands);
      await writeFile(path.join(commands, 'uname'), `#!/usr/bin/env bash
printf '%s\\n' '${platform}'
`, { mode: 0o755 });
      await writeFile(path.join(commands, 'id'), `#!/usr/bin/env bash
case "$1" in
  -u) printf '%s\\n' '${hostUid}' ;;
  -g) printf '%s\\n' '${hostGid}' ;;
  *) exit 1 ;;
esac
`, { mode: 0o755 });
      const result = spawnSync('bash', [script, 'prepare'], {
        env: { ...process.env, INTEROP_BE_ROOT: root, PATH: `${commands}:${process.env.PATH}` },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      const compose = JSON.parse(await readFile(path.join(root, '.local-development', 'dashboard', 'compose.yml'), 'utf8'));
      assert.equal(compose.services.dashboard.environment.LOCAL_UID, runtimeUid);
      assert.equal(compose.services.dashboard.environment.LOCAL_GID, runtimeGid);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

for (const existingGroup of ['', 'docker']) {
  test(`bootstrap ${existingGroup ? 'reuses an existing' : 'creates a missing'} Docker socket group`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'interop-bootstrap-test-'));
    try {
      const calls = path.join(root, 'calls');
      const mockCommand = `#!/usr/bin/env bash
printf '%s %s\\n' "\${0##*/}" "$*" >> "$TEST_CALLS"
case "\${0##*/}" in
  id) printf '1000\\n' ;;
  stat)
    if [[ "$2" == '%g' ]]; then printf '4321\\n'; else printf '1000:1000\\n'; fi ;;
  getent)
    if [[ -z "$TEST_SOCKET_GROUP" ]]; then exit 2; fi
    printf '%s:x:4321:\\n' "$TEST_SOCKET_GROUP" ;;
esac
`;
      for (const command of ['id', 'stat', 'getent', 'groupadd', 'groupmod', 'usermod', 'mountpoint', 'chown', 'gosu']) {
        await writeFile(path.join(root, command), mockCommand, { mode: 0o755 });
      }
      const result = spawnSync('bash', [entrypoint], {
        env: {
          ...process.env,
          INTEROP_BE_ROOT: root,
          LOCAL_UID: '1000',
          LOCAL_GID: '1000',
          PATH: `${root}:${process.env.PATH}`,
          TEST_CALLS: calls,
          TEST_SOCKET_GROUP: existingGroup,
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      const commands = (await readFile(calls, 'utf8')).trim().split('\n');
      assert.deepEqual(commands.filter((command) => command.startsWith('groupadd ')), existingGroup
        ? [] : ['groupadd -g 4321 dashboard-docker']);
      assert.ok(commands.includes(`usermod -aG ${existingGroup || 'dashboard-docker'} node`));
      assert.equal(commands.at(-1), 'gosu node /usr/local/bin/dashboard-entrypoint --user');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

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
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Unknown argument: --frontend/);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), backendOnly);
    assert.ok(!('INTEROP_FE_ROOT' in runtime.environment));
    assert.ok(!('INTEROP_DEVCONTAINER' in runtime.environment));
    assert.ok(!runtime.volumes.some((v) => v.source === frontend || v.source === 'dashboard-browser-cache'));
    assert.ok(!runtime.ports.some((p) => p.target === 5173 || p.published === '3000'));
    assert.ok(runtime.ports.some((p) => p.target === 3000 && p.published === '13000'));
    assert.ok(runtime.ports.some((p) => p.target === 4700 && p.published === '4700' && p.host_ip === '127.0.0.1'));
    const repeated = prepare();
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), backendOnly);
    const selected = prepare(['--preset', 'frontend-full']);
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
    assert.ok(!('INTEROP_FE_ROOT' in configured.environment));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('infra operations target infrastructure and preserve the dashboard during reset', async () => {
  const scriptPath = new URL('../dashboard-infra.sh', import.meta.url).pathname;
  const root = await mkdtemp(path.join(tmpdir(), 'interop-infra-test-'));
  try {
    await mkdir(path.join(root, '.local-development'));
    const stateFile = path.join(root, '.local-development', 'state.json');
    const legacyTokenFile = path.join(root, '.local-development', 'frontend-token');
    await writeFile(stateFile, '{"tenants":{}}');
    await writeFile(legacyTokenFile, 'legacy frontend token');
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
        env: { ...process.env, INTEROP_BE_ROOT: root, PATH: `${root}:${process.env.PATH}`, TEST_CALLS: calls }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    }
    const commands = (await readFile(calls, 'utf8')).split('\n');
    const mutations = commands.filter((c) => /\b(up|stop|rm|volume rm)\b/.test(c));
    assert.ok(mutations.some((c) => c.includes('up -d event-store selfcare-mock')));
    assert.ok(mutations.every((c) => !/\bdashboard\b/.test(c)));
    assert.ok(mutations.every((c) => !/\bdown\b|--remove-orphans|modules/.test(c)));
    assert.ok(mutations.some((c) => c.includes('volume rm pagopa-interop_event-store-data')));
    await assert.rejects(readFile(stateFile, 'utf8'), { code: 'ENOENT' });
    assert.equal(await readFile(legacyTokenFile, 'utf8'), 'legacy frontend token');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
