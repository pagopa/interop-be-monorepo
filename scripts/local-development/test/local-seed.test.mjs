import { KMSClient } from "@aws-sdk/client-kms";
import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const tenantUrl = "http://localhost:3500";
const catalogUrl = "http://localhost:3000";

async function fixture(context, { existing, classified }) {
  const root = await mkdtemp(join(tmpdir(), "interop-local-seed-"));
  const argv = process.argv;
  const environment = {
    TENANT_PROCESS_URL: process.env.TENANT_PROCESS_URL,
    CATALOG_PROCESS_URL: process.env.CATALOG_PROCESS_URL,
  };
  context.after(async () => {
    process.argv = argv;
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  });
  process.env.TENANT_PROCESS_URL = tenantUrl;
  process.env.CATALOG_PROCESS_URL = catalogUrl;
  process.argv = [
    process.execPath,
    join(root, "scripts/local-development/cli.mjs"),
    "seed",
  ];

  await mkdir(join(root, "scripts/local-development"), { recursive: true });
  await mkdir(join(root, "docker/local-development"), { recursive: true });
  for (const file of ["cli.mjs", "local-environment.mjs"]) {
    await cp(
      join(repository, "scripts/local-development", file),
      join(root, "scripts/local-development", file)
    );
  }
  await cp(
    join(repository, "docker/local-development/dataset.json"),
    join(root, "docker/local-development/dataset.json")
  );
  await symlink(
    join(repository, "node_modules"),
    join(root, "node_modules"),
    "dir"
  );

  const dataset = JSON.parse(
    await readFile(join(root, "docker/local-development/dataset.json"), "utf8")
  );
  const tenants = new Map();
  const upserts = [];
  const pendingKinds = new Map();
  const expectedKind = (tenant) =>
    tenant.key === "impresa" ? "PRIVATE" : "PA";
  const makeTenant = (tenant, kind) => ({
    id: `interop-${tenant.key}`,
    name: tenant.name,
    selfcareId: tenant.selfcareId,
    externalId: tenant.externalId,
    kind,
    attributes: [],
    mails: [
      {
        id: `mail-${tenant.key}`,
        kind: "CONTACT_EMAIL",
        address: tenant.contactEmail,
      },
    ],
  });
  if (existing) {
    for (const tenant of dataset.tenants) {
      tenants.set(
        tenant.selfcareId,
        makeTenant(
          tenant,
          classified
            ? tenant.key === "provider"
              ? "GSP"
              : expectedKind(tenant)
            : undefined
        )
      );
    }
    await mkdir(join(root, ".local-development"));
    await writeFile(
      join(root, ".local-development/state.json"),
      JSON.stringify({
        datasetVersion: dataset.version,
        tenants: Object.fromEntries(
          dataset.tenants.map((tenant) => [
            tenant.key,
            { id: `interop-${tenant.key}` },
          ])
        ),
      })
    );
  }

  context.mock.method(KMSClient.prototype, "send", async () => ({
    Signature: new Uint8Array([1, 2, 3]),
  }));
  context.mock.method(console, "log", () => {});
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status });
  const eservice = {
    id: "demo-eservice",
    name: "Catalogo Demo",
    personalData: false,
    descriptors: [{ id: "demo-descriptor", state: "PUBLISHED" }],
  };
  context.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const { pathname, origin } = new URL(url);
    const method = options.method ?? "GET";
    if (pathname === "/status") return json({ status: "ok" });
    if (
      origin === tenantUrl &&
      pathname === "/selfcare/tenants" &&
      method === "POST"
    ) {
      const seed = JSON.parse(options.body);
      upserts.push(seed);
      const tenant = dataset.tenants.find(
        (candidate) => candidate.selfcareId === seed.selfcareId
      );
      assert.ok(tenant);
      assert.deepEqual(seed, {
        externalId: tenant.externalId,
        name: tenant.name,
        selfcareId: tenant.selfcareId,
        selfcareInstitutionType: tenant.institutionType,
        onboardedAt: "2024-01-01T00:00:00.000Z",
      });
      if (!tenants.has(seed.selfcareId)) {
        // Onboarding leaves IPA tenants unclassified until a later update.
        tenants.set(
          seed.selfcareId,
          makeTenant(
            tenant,
            tenant.externalId.origin === "IPA" ? undefined : "PRIVATE"
          )
        );
      } else {
        // The readmodel still returns the old value for the first poll.
        pendingKinds.set(seed.selfcareId, {
          kind: expectedKind(tenant),
          reads: 0,
        });
      }
      return json({ id: tenants.get(seed.selfcareId).id });
    }
    if (origin === tenantUrl && method === "GET") {
      const tenant = [...tenants.values()].find(
        (candidate) =>
          pathname === `/tenants/selfcare/${candidate.selfcareId}` ||
          pathname === `/tenants/${candidate.id}`
      );
      if (!tenant) return json({ title: "Tenant not found" }, 404);
      const pending = pendingKinds.get(tenant.selfcareId);
      if (pending && ++pending.reads > 1) {
        tenant.kind = pending.kind;
        pendingKinds.delete(tenant.selfcareId);
      }
      return json(tenant);
    }
    if (origin === catalogUrl && method === "GET") {
      assert.ok(
        dataset.tenants.every((tenant) => tenants.get(tenant.selfcareId)?.kind),
        "catalog seed must wait for every tenant kind to propagate"
      );
      if (pathname === "/eservices") return json({ results: [eservice] });
      if (pathname === `/eservices/${eservice.id}`) return json(eservice);
    }
    throw new Error(`Unexpected seed request: ${method} ${url}`);
  });

  return {
    dataset,
    tenants,
    upserts,
    state: async () =>
      JSON.parse(
        await readFile(join(root, ".local-development/state.json"), "utf8")
      ),
    run: (attempt) =>
      import(
        `${pathToFileURL(join(root, "scripts/local-development/cli.mjs")).href}?attempt=${attempt}`
      ),
  };
}

for (const existing of [false, true]) {
  test(`seed classifies ${existing ? "existing" : "new"} tenants and waits for kind propagation before completing`, async (context) => {
    const seed = await fixture(context, { existing, classified: false });
    await seed.run(1);

    for (const tenant of seed.dataset.tenants) {
      const current = seed.tenants.get(tenant.selfcareId);
      assert.equal(current.kind, tenant.key === "impresa" ? "PRIVATE" : "PA");
      assert.equal(
        seed.upserts.filter((body) => body.selfcareId === tenant.selfcareId)
          .length,
        existing ? 1 : tenant.key === "impresa" ? 1 : 2
      );
      assert.deepEqual((await seed.state()).tenants[tenant.key], {
        id: current.id,
      });
      assert.deepEqual(current.mails, [
        {
          id: `mail-${tenant.key}`,
          kind: "CONTACT_EMAIL",
          address: tenant.contactEmail,
        },
      ]);
    }

    const upsertCount = seed.upserts.length;
    await seed.run(2);
    assert.equal(
      seed.upserts.length,
      upsertCount,
      "rerunning seed must preserve classified tenants without further upserts"
    );
  });
}

test("seed preserves existing tenant kinds, including GSP, without upserting them", async (context) => {
  const seed = await fixture(context, { existing: true, classified: true });
  await seed.run(1);

  assert.equal(seed.upserts.length, 0);
  assert.equal(
    seed.tenants.get(
      seed.dataset.tenants.find((tenant) => tenant.key === "provider")
        .selfcareId
    ).kind,
    "GSP"
  );
});
