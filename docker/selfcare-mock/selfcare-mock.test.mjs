import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createSelfcareMockServer } from "./selfcare-mock.mjs";

const dataset = {
  product: {
    id: "prod-interop",
    title: "PDND Interoperabilita",
  },
  tenants: [
    {
      key: "comune",
      externalId: { origin: "IPA", value: "LOCAL-COMUNE" },
      selfcareId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Comune Demo",
      institutionType: "PA",
    },
    {
      key: "provider",
      externalId: { origin: "IPA", value: "LOCAL-PROVIDER" },
      selfcareId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Provider Demo",
      institutionType: "PA",
    },
  ],
  users: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      memberships: [
        {
          tenantSelfcareId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          roles: ["security"],
        },
        {
          tenantSelfcareId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          roles: ["api", "viewer"],
        },
      ],
      name: "Ada",
      surname: "Lovelace",
      email: "ada@example.test",
    },
  ],
};

let baseUrl;
let server;

before(async () => {
  server = createSelfcareMockServer(dataset);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test("returns a readiness response", async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("returns institution details", async () => {
  const response = await fetch(
    `${baseUrl}/institutions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    description: "Comune Demo",
    externalId: "LOCAL-COMUNE",
    institutionType: "PA",
  });
});

test("returns products for an institution", async () => {
  const response = await fetch(
    `${baseUrl}/institutions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/products?userId=22222222-2222-4222-8222-222222222222`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      contractTemplatePath: "",
      contractTemplateVersion: "",
      description: "PDND Interoperabilita",
      id: "prod-interop",
      roleMappings: {},
      title: "PDND Interoperabilita",
      urlBO: "",
    },
  ]);
});

test("returns institution users with roles", async () => {
  const response = await fetch(
    `${baseUrl}/institutions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/users?userId=22222222-2222-4222-8222-222222222222&productRoles=security`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Ada",
      surname: "Lovelace",
      email: "ada@example.test",
      role: "MANAGER",
      roles: ["security"],
    },
  ]);
});

test("returns all institutions associated with a user", async () => {
  const response = await fetch(
    `${baseUrl}/users?userId=22222222-2222-4222-8222-222222222222&states=ACTIVE&products=prod-interop`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      institutionDescription: "Comune Demo",
      institutionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      products: [
        {
          productId: "prod-interop",
          productRole: "security",
          productRoleLabel: "security",
          role: "MANAGER",
          status: "ACTIVE",
        },
      ],
      userId: "22222222-2222-4222-8222-222222222222",
    },
    {
      institutionDescription: "Provider Demo",
      institutionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      products: [
        {
          productId: "prod-interop",
          productRole: "api",
          productRoleLabel: "api",
          role: "MANAGER",
          status: "ACTIVE",
        },
        {
          productId: "prod-interop",
          productRole: "viewer",
          productRoleLabel: "viewer",
          role: "MANAGER",
          status: "ACTIVE",
        },
      ],
      userId: "22222222-2222-4222-8222-222222222222",
    },
  ]);
});

test("returns user details", async () => {
  const response = await fetch(
    `${baseUrl}/users/22222222-2222-4222-8222-222222222222`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ada",
    surname: "Lovelace",
    email: "ada@example.test",
  });
});

test("returns a Selfcare-compatible 404 response", async () => {
  const response = await fetch(`${baseUrl}/users/missing`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    status: 404,
    title: "Not Found",
    detail: "GET /users/missing",
  });
});
