import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Command, Driver } from "../src/model/domain/models.js";

import { identityServiceBuilder } from "../src/services/identityService.js";
const paths: string[] = [];
afterEach(async () => {
  await Promise.all(
    paths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "dashboard-identities-"));
  paths.push(root);
  await mkdir(join(root, "docker/local-development"), { recursive: true });
  await mkdir(join(root, ".local-development"));
  await writeFile(
    join(root, "docker/local-development/dataset.json"),
    JSON.stringify({
      tenants: [{ key: "comune", selfcareId: "selfcare", name: "Comune" }],
      users: [
        {
          id: "user-id",
          key: "admin",
          name: "User",
          surname: "Admin",
          email: "admin@local.test",
          memberships: [{ tenantSelfcareId: "selfcare", roles: ["admin"] }],
        },
      ],
    })
  );
  return root;
};
describe("local identities", () => {
  it("preserves tenant/user order and the first membership when grouping configured users", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "docker/local-development/dataset.json"),
      JSON.stringify({
        tenants: [
          { key: "second", selfcareId: "shared", name: "Second" },
          { key: "first", selfcareId: "shared", name: "First" },
          { key: "unseeded", selfcareId: "other", name: "Unseeded" },
        ],
        users: [
          {
            id: "second-user",
            key: "second",
            name: "Second",
            surname: "User",
            email: "second@local.test",
            memberships: [
              { tenantSelfcareId: "shared", roles: ["admin"] },
              { tenantSelfcareId: "shared", roles: ["operator"] },
            ],
          },
          {
            id: "first-user",
            key: "first",
            name: "First",
            surname: "User",
            email: "first@local.test",
            memberships: [{ tenantSelfcareId: "shared", roles: ["operator"] }],
          },
        ],
      })
    );
    await writeFile(
      join(root, ".local-development/state.json"),
      JSON.stringify({
        tenants: {
          first: { id: "first-id" },
          second: { id: "second-id" },
        },
      })
    );
    const driver: Driver = {
      run: async () => "header.payload.signature",
      start: async () => ({ pid: 1, stop: async () => undefined }),
    };
    const data = await identityServiceBuilder(root, driver).identities();

    expect(data.ready).toBe(false);
    expect(
      data.tenants.map(({ key, users }) => ({
        key,
        users: users.map(({ id, roles }) => ({ id, roles })),
      }))
    ).toEqual([
      {
        key: "second",
        users: [
          { id: "second-user", roles: ["admin"] },
          { id: "first-user", roles: ["operator"] },
        ],
      },
      {
        key: "first",
        users: [
          { id: "second-user", roles: ["admin"] },
          { id: "first-user", roles: ["operator"] },
        ],
      },
    ]);
  });

  it("keeps queued identity selections available after a failed selection", async () => {
    const root = await fixture();
    await writeFile(
      join(root, ".local-development/state.json"),
      JSON.stringify({ tenants: { comune: { id: "tenant-id" } } })
    );
    let attempts = 0;
    const driver: Driver = {
      run: async () => {
        if (++attempts === 1) throw new Error("Local token failed");
        return "header.payload.signature";
      },
      start: async () => ({ pid: 1, stop: async () => undefined }),
    };
    const identities = identityServiceBuilder(root, driver);
    const first = identities.identity({
      tenantKey: "comune",
      userId: "user-id",
    });
    const second = identities.identity({
      tenantKey: "comune",
      userId: "user-id",
    });
    await expect(first).rejects.toThrow("Local token failed");
    await expect(second).resolves.toEqual({
      sessionToken: "header.payload.signature",
    });
    expect(attempts).toBe(2);
  });

  it("exposes only seeded tenants and their configured users and refuses unknown identities", async () => {
    const root = await fixture();
    const commands: Command[] = [];
    const driver: Driver = {
      run: async (command) => {
        commands.push(command);
        return "header.payload.signature\n";
      },
      start: async () => ({ pid: 1, stop: async () => undefined }),
    };
    const identities = identityServiceBuilder(root, driver, "/frontend");
    expect(await identities.identities()).toEqual({
      ready: false,
      tenants: [],
    });
    await expect(
      identities.identity({ tenantKey: "comune", userId: "user-id" })
    ).rejects.toThrow(/unseeded/);
    expect(commands).toHaveLength(0);
    await writeFile(
      join(root, ".local-development/state.json"),
      JSON.stringify({ tenants: { comune: { id: "tenant-id" } } })
    );
    expect(await identities.identities()).toMatchObject({
      ready: true,
      tenants: [
        {
          key: "comune",
          id: "tenant-id",
          users: [{ id: "user-id", roles: ["admin"] }],
        },
      ],
    });
    expect(
      await identities.identity({ tenantKey: "comune", userId: "user-id" })
    ).toEqual({ sessionToken: "header.payload.signature" });
    expect(
      await readFile(join(root, ".local-development/frontend-token"), "utf8")
    ).toBe("header.payload.signature\n");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      privateOutput: true,
      env: { LOCAL_KMS_ENDPOINT: "http://localhost:4566" },
    });
  });
  it("serializes simultaneous token selections so the persisted token cannot interleave", async () => {
    const root = await fixture();
    await writeFile(
      join(root, ".local-development/state.json"),
      JSON.stringify({ tenants: { comune: { id: "tenant-id" } } })
    );
    let active = 0;
    let maximum = 0;
    let sequence = 0;
    const driver: Driver = {
      run: async () => {
        active++;
        maximum = Math.max(maximum, active);
        const id = ++sequence;
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return `header.payload.${id}`;
      },
      start: async () => ({ pid: 1, stop: async () => undefined }),
    };
    const identities = identityServiceBuilder(root, driver, "/frontend");
    await Promise.all([
      identities.identity({ tenantKey: "comune", userId: "user-id" }),
      identities.identity({ tenantKey: "comune", userId: "user-id" }),
    ]);
    expect(maximum).toBe(1);
    expect(
      await readFile(join(root, ".local-development/frontend-token"), "utf8")
    ).toBe("header.payload.2\n");
  });
});
