import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { Tenant } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  addOneTenant,
  attributeRegistryService,
  postgresDB,
} from "../integrationUtils.js";

describe("certified discrete attribute creation", () => {
  const invalidSeeds: Array<{
    field: string;
    seed: attributeRegistryApi.CertifiedAttributeSeed;
  }> = [
    {
      field: "name",
      seed: {
        name: "Visit https://example.test for details",
        description: "Certified discrete attribute description",
        code: "001",
      },
    },
    {
      field: "description",
      seed: {
        name: "Certified discrete attribute",
        description: "Visit https://example.test for details",
        code: "002",
      },
    },
    {
      field: "code",
      seed: {
        name: "Certified discrete attribute",
        description: "Certified discrete attribute description",
        code: "https://example.test",
      },
    },
  ];

  it.each(invalidSeeds)(
    "should reject hyperlinks in $field",
    async ({ field, seed }) => {
      const tenant: Tenant = {
        ...getMockTenant(),
        features: [{ type: "PersistentCertifier", certifierId: "certifier" }],
      };
      await addOneTenant(tenant);

      await expect(
        attributeRegistryService.createCertifiedDiscreteAttribute(
          seed,
          getMockContext({ authData: getMockAuthData(tenant.id) })
        )
      ).rejects.toMatchObject({
        code: "badRequestError",
        detail: `The ${field} field must not contain hyperlinks`,
      });
      await expect(
        postgresDB.any("SELECT 1 FROM attribute.events LIMIT 1")
      ).resolves.toEqual([]);
    }
  );
});
