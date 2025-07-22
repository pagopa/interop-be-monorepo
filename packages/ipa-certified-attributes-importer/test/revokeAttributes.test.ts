/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import { randomUUID } from "crypto";
import { Attribute, Tenant, unsafeBrandId } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  TenantSeed,
  getAttributesToRevoke,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { attributes } from "./expectation.js";

describe("GetAttributesToRevoke", async () => {
  it("should revoke only assigned attributes that exist and doesn't have a revocation timestamp", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [],
      },
    ];

    const platformAttributes: Attribute[] = [
      ...attributes.slice(0, 1),
      ...attributes.slice(2),
    ].map((a) => ({
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
            revocationTimestamp: new Date(),
          },
          {
            id: platformAttributes[1].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
    ];

    const attributesToRevoke = await getAttributesToRevoke(
      tenantSeed,
      ipaTenants,
      platformAttributes
    );

    expect(attributesToRevoke).toEqual([
      {
        tOrigin: ipaTenants[0].externalId.origin,
        tExternalId: ipaTenants[0].externalId.value,
        aOrigin: attributes[2].origin,
        aCode: attributes[2].code,
      },
    ]);
  });

  it("should revoke only assigned attributes with origin IPA", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [],
      },
    ];

    const platformAttributes: Attribute[] = attributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    platformAttributes[0].origin = "NON-IPA";

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
          {
            id: platformAttributes[1].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
    ];

    const attributesToRevoke = await getAttributesToRevoke(
      tenantSeed,
      ipaTenants,
      platformAttributes
    );

    expect(attributesToRevoke).toEqual([
      {
        tOrigin: ipaTenants[0].externalId.origin,
        tExternalId: ipaTenants[0].externalId.value,
        aOrigin: attributes[1].origin,
        aCode: attributes[1].code,
      },
    ]);
  });
});
