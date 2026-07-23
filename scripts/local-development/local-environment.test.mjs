import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSelfcareTenantSeed,
  buildSessionClaims,
  buildTenantContactMailSeed,
  buildTokenPayload,
  hasTenantContactEmail,
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
      contactEmail: "interop@comune.demo",
      userId: "10000000-0000-4000-8000-000000000001",
    },
    {
      key: "provider",
      externalId: { origin: "IPA", value: "LOCAL-PROVIDER" },
      selfcareId: "00000000-0000-4000-8000-000000000002",
      name: "Provider Demo",
      institutionType: "PA",
      contactEmail: "interop@provider.demo",
    },
  ],
  users: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      key: "reviewer",
      memberships: [
        {
          tenantSelfcareId: "00000000-0000-4000-8000-000000000001",
          roles: ["security", "reviewer"],
        },
        {
          tenantSelfcareId: "00000000-0000-4000-8000-000000000002",
          roles: ["admin", "viewer"],
        },
      ],
      name: "Ada",
      surname: "Lovelace",
      email: "ada@example.test",
    },
  ],
};

const state = {
  tenants: {
    comune: { id: "20000000-0000-4000-8000-000000000001" },
    provider: { id: "20000000-0000-4000-8000-000000000002" },
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

test("builds the tenant contact mail seed required by agreements", () => {
  assert.deepEqual(buildTenantContactMailSeed(dataset.tenants[0]), {
    kind: "CONTACT_EMAIL",
    address: "interop@comune.demo",
    description: "Local development contact email",
  });
});

test("detects whether the tenant contact email is already seeded", () => {
  assert.equal(
    hasTenantContactEmail(
      { mails: [] },
      "interop@comune.demo"
    ),
    false
  );
  assert.equal(
    hasTenantContactEmail(
      {
        mails: [
          {
            kind: "CONTACT_EMAIL",
            address: "interop@comune.demo",
          },
        ],
      },
      "interop@comune.demo"
    ),
    true
  );
});

test("selects a tenant and its membership roles from the dataset", () => {
  const identity = selectIdentity(dataset, state, "comune", "reviewer");

  assert.equal(identity.tenant.id, "20000000-0000-4000-8000-000000000001");
  assert.equal(identity.user.id, "10000000-0000-4000-8000-000000000001");
  assert.deepEqual(identity.roles, ["security", "reviewer"]);
});

test("selects the same local user across multiple tenants", () => {
  const identity = selectIdentity(
    dataset,
    state,
    "provider",
    "10000000-0000-4000-8000-000000000001"
  );

  assert.equal(identity.tenant.id, "20000000-0000-4000-8000-000000000002");
  assert.equal(identity.user.id, "10000000-0000-4000-8000-000000000001");
});

test("rejects users not assigned to the selected tenant", () => {
  assert.throws(
    () => selectIdentity(dataset, state, "provider", "missing-user"),
    /No local user configured for tenant provider/
  );
});

test("builds UI session claims with Selfcare and Interop tenant IDs", () => {
  const identity = selectIdentity(dataset, state, "comune", "reviewer");

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
      roles: [
        { partyRole: "MANAGER", role: "security" },
        { partyRole: "MANAGER", role: "reviewer" },
      ],
    },
    organizationId: "20000000-0000-4000-8000-000000000001",
    selfcareId: "00000000-0000-4000-8000-000000000001",
    uid: "10000000-0000-4000-8000-000000000001",
    "user-roles": "security,reviewer",
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
