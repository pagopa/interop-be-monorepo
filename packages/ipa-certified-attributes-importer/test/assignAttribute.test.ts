/* eslint-disable sonarjs/no-identical-functions */
import { randomUUID } from "crypto";
import { Attribute, Tenant, unsafeBrandId } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { TenantSeed, getAttributesToAssign } from "../src/index.js";
import { attributes } from "./expectation.js";

describe("GetAttributesToAssign", async () => {
  it("assign attribute only to tenant already present in the platform", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: attributes[0].code,
          },
          {
            origin: "IPA",
            code: attributes[1].code,
          },
        ],
      },
      {
        origin: "IPA",
        originId: "2",
        description: "tenant2",
        attributes: [
          {
            origin: "IPA",
            code: attributes[2].code,
          },
          {
            origin: "IPA",
            code: attributes[3].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = attributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("2"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "2" },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: "tenant 2",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 2",
        certifiedAttributes: [
          { origin: attributes[2].origin, code: attributes[2].code },
          { origin: attributes[3].origin, code: attributes[3].code },
        ],
        externalId: { origin: "IPA", value: "2" },
      },
    ]);
  });

  it("assign attribute only if is not already assigned or if the revocation timestamp is present", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: attributes[0].code,
          },
          {
            origin: "IPA",
            code: attributes[1].code,
          },
        ],
      },
      {
        origin: "IPA",
        originId: "2",
        description: "tenant2",
        attributes: [
          {
            origin: "IPA",
            code: attributes[2].code,
          },
          {
            origin: "IPA",
            code: attributes[3].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = attributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("1"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "1" },
        features: [],
        attributes: [
          {
            id: platformAttributes[0].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
      {
        id: unsafeBrandId("2"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "2" },
        features: [],
        attributes: [
          {
            id: platformAttributes[2].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
          {
            id: platformAttributes[3].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 2",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 1",
        certifiedAttributes: [
          { origin: attributes[1].origin, code: attributes[1].code },
        ],
        externalId: { origin: "IPA", value: "1" },
      },
      {
        name: "tenant 2",
        certifiedAttributes: [
          { origin: attributes[3].origin, code: attributes[3].code },
        ],
        externalId: { origin: "IPA", value: "2" },
      },
    ]);
  });
});
