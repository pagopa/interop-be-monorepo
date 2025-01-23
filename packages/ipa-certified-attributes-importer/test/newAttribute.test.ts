import { randomUUID } from "crypto";
import { expect, describe, it } from "vitest";
import { Attribute, unsafeBrandId } from "pagopa-interop-models";
import { TenantSeed, getNewAttributes } from "../src/index.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

describe("NewAttributes", async () => {
  it("create only attribute that are not present and that will be assigned to a tenant", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const assignedAttributes = attributes.slice(0, 2);

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: assignedAttributes[0].code,
          },
          {
            origin: "IPA",
            code: assignedAttributes[1].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = [];

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual(assignedAttributes);
  });

  it("doesn't create any attribute if already present in the platform", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const assignedAttributes = attributes.slice(0, 2);

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: assignedAttributes[0].code,
          },
          {
            origin: "IPA",
            code: assignedAttributes[1].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = assignedAttributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual([]);
  });

  it("doesn't create any attribute if are not to assign to any tenant", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [],
      },
    ];

    const platformAttributes: Attribute[] = [];

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual([]);
  });
});
