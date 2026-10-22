import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entrypoint = fileURLToPath(new URL('../../../docker/dev-dashboard/entrypoint.sh', import.meta.url));

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

test('infra operations target infrastructure and preserve the dashboard during reset', async () => {
  const scriptPath = fileURLToPath(new URL('../dashboard-infra.sh', import.meta.url));
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
  *'config --format json'*) printf '%s' '{"name":"pagopa-interop","volumes":{"event-store-data":{"name":"pagopa-interop_event-store-data"},"dashboard-be-modules":{"name":"pagopa-interop_dashboard-be-modules"},"dashboard-pnpm-store":{"name":"pagopa-interop_dashboard-pnpm-store"}},"services":{"event-store":{"volumes":[{"type":"volume","source":"event-store-data"}]},"dashboard":{"volumes":[{"type":"volume","source":"dashboard-be-modules"},{"type":"volume","source":"dashboard-pnpm-store"}]}}}' ;;
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
