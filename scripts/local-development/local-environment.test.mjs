import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSelfcareTenantSeed,
  buildSessionClaims,
  buildTokenPayload,
  selectIdentity,
} from "./local-environment.mjs";

const dataset = {
  tenants: [
    {
      key: "comune",
      externalId: { origin: "IPA", value: "LOCAL-COMUNE" },
      selfcareId: "00000000-0000-4000-8000-000000000001",
      name: "Comune Demo",
      institutionType: "PA",
      userId: "10000000-0000-4000-8000-000000000001",
    },
  ],
  users: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      tenantSelfcareId: "00000000-0000-4000-8000-000000000001",
      name: "Ada",
      surname: "Lovelace",
      email: "ada@example.test",
      roles: ["admin", "api", "security", "reviewer", "viewer"],
    },
  ],
};

const state = {
  tenants: {
    comune: { id: "20000000-0000-4000-8000-000000000001" },
  },
};

test("builds an idempotent Selfcare tenant seed", () => {
  assert.deepEqual(buildSelfcareTenantSeed(dataset.tenants[0]), {
    externalId: { origin: "IPA", value: "LOCAL-COMUNE" },
    name: "Comune Demo",
    selfcareId: "00000000-0000-4000-8000-000000000001",
    selfcareInstitutionType: "PA",
    onboardedAt: "2024-01-01T00:00:00.000Z",
  });
});

test("selects a tenant and role from the dataset", () => {
  const identity = selectIdentity(dataset, state, "comune", "reviewer");

  assert.equal(identity.tenant.id, "20000000-0000-4000-8000-000000000001");
  assert.equal(identity.user.id, "10000000-0000-4000-8000-000000000001");
  assert.equal(identity.role, "reviewer");
});

test("rejects roles not assigned to the selected local user", () => {
  assert.throws(
    () => selectIdentity(dataset, state, "comune", "support"),
    /Role support is not available for tenant comune/
  );
});

test("builds UI session claims with Selfcare and Interop tenant IDs", () => {
  const identity = selectIdentity(dataset, state, "comune", "admin");

  assert.deepEqual(buildSessionClaims(identity), {
    email: "ada@example.test",
    externalId: { origin: "IPA", value: "LOCAL-COMUNE" },
    family_name: "Lovelace",
    name: "Ada",
    organization: {
      fiscal_code: "LOCAL-COMUNE",
      id: "00000000-0000-4000-8000-000000000001",
      ipaCode: "LOCAL-COMUNE",
      name: "Comune Demo",
      roles: [{ partyRole: "MANAGER", role: "admin" }],
    },
    organizationId: "20000000-0000-4000-8000-000000000001",
    selfcareId: "00000000-0000-4000-8000-000000000001",
    uid: "10000000-0000-4000-8000-000000000001",
    "user-roles": "admin",
  });
});

test("builds session and internal token payloads with the expected audiences", () => {
  const user = dataset.users[0];
  const session = buildTokenPayload({
    claims: { uid: user.id },
    kind: "session",
    now: 100,
    durationSeconds: 60,
  });
  const internal = buildTokenPayload({
    kind: "internal",
    now: 100,
    durationSeconds: 60,
  });

  assert.equal(session.aud, "dev.interop.pagopa.it/ui");
  assert.equal(session.uid, user.id);
  assert.equal(session.exp, 160);
  assert.equal(internal.aud, "dev.interop.pagopa.it/internal");
  assert.equal(internal.role, "internal");
});
