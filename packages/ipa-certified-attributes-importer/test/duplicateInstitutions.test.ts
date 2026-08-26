import { randomUUID } from "crypto";
import { genericLogger } from "pagopa-interop-commons";
import {
  Attribute,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { parseIPACertifiedAttributesImporterConfig } from "../src/config/config.js";
import {
  getAttributesToAssign,
  getTenantUpsertData,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { Institution } from "../src/services/openDataExtractor.js";
import {
  dedupeCertifiedAttributes,
  dedupeInstitutions,
} from "../src/services/openDataService.js";

describe("Duplicated records in the IPA open data", () => {
  const config = parseIPACertifiedAttributesImporterConfig(process.env);

  const institution: Institution = {
    id: "12345678901",
    originId: "UO-DUP",
    category: "C17",
    description: "Ufficio duplicato - Comune di Test",
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    kind: "Altro",
    classification: "UO",
  };

  const registryData = {
    institutions: dedupeInstitutions([institution, institution]),
    attributes: [],
  };

  const platformTenant: Tenant = {
    id: unsafeBrandId(randomUUID()),
    selfcareId: "fake-selfcare-id",
    externalId: {
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      value: institution.originId,
    },
    features: [],
    attributes: [],
    createdAt: new Date(),
    mails: [],
    name: institution.description,
  };

  const platformAttributes: Attribute[] = [
    {
      id: unsafeBrandId(randomUUID()),
      name: institution.category,
      code: institution.category,
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      kind: "Certified",
      description: "",
      creationTime: new Date(),
    },
  ];

  it("should keep a single record for institutions sharing origin and originId", () => {
    expect(dedupeInstitutions([institution, institution])).toEqual([
      institution,
    ]);
  });

  it("should keep a single attribute for seeds sharing origin and code", () => {
    const attributeSeed = {
      code: institution.category,
      description: institution.description,
      origin: institution.origin,
      name: institution.description,
    };

    expect(
      dedupeCertifiedAttributes([attributeSeed, attributeSeed])
    ).toHaveLength(1);
  });

  it("should produce a single tenant seed for duplicated open data rows", () => {
    const upsertData = getTenantUpsertData(registryData, [platformTenant], []);

    expect(upsertData).toHaveLength(1);
    expect(upsertData[0].originId).toBe(institution.originId);
  });

  it("should upsert the same tenant only once", async () => {
    const upsertData = getTenantUpsertData(registryData, [platformTenant], []);

    const attributesToAssign = await getAttributesToAssign(
      [platformTenant],
      platformAttributes,
      upsertData,
      config,
      genericLogger
    );

    expect(attributesToAssign).toHaveLength(1);
    expect(attributesToAssign[0].certifiedAttributes).toEqual([
      {
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: institution.category,
      },
    ]);
  });
});
