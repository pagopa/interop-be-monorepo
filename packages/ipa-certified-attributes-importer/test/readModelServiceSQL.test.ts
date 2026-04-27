import { afterEach, beforeAll, describe, expect, it, inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  attributeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAttribute,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import {
  Attribute,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  attributeKind,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

const baseTenant = (): Tenant => ({
  id: generateId(),
  externalId: { origin: "unset", value: "unset" },
  attributes: [],
  features: [],
  name: "tenantName",
  createdAt: new Date(),
  mails: [],
});

const baseAttribute = (): Attribute => ({
  id: generateId(),
  origin: "unset",
  code: "unset",
  name: "attributeName",
  kind: attributeKind.certified,
  creationTime: new Date(),
  description: "attributeDescription",
});

describe("IPA readModelServiceSQL", () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("getIPATenants", () => {
    it("should return only tenants with IPA external id origin", async () => {
      const ipaTenant1: Tenant = {
        ...baseTenant(),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-1",
        },
      };
      const ipaTenant2: Tenant = {
        ...baseTenant(),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-2",
        },
      };
      const nonIpaTenant: Tenant = {
        ...baseTenant(),
        externalId: { origin: "ANAC", value: "non-ipa" },
      };

      await upsertTenant(readModelDB, ipaTenant1, 0);
      await upsertTenant(readModelDB, ipaTenant2, 0);
      await upsertTenant(readModelDB, nonIpaTenant, 0);

      const tenants = await readModelServiceSQL.getIPATenants();

      expect(tenants).toHaveLength(2);
      const ids = tenants.map((t) => t.id).sort();
      expect(ids).toEqual([ipaTenant1.id, ipaTenant2.id].sort());
    });

    it("should return an empty array when no IPA tenants exist", async () => {
      await upsertTenant(
        readModelDB,
        {
          ...baseTenant(),
          externalId: { origin: "ANAC", value: "non-ipa" },
        },
        0
      );

      const tenants = await readModelServiceSQL.getIPATenants();

      expect(tenants).toHaveLength(0);
    });
  });

  describe("getAttributes", () => {
    it("should return only certified attributes with IPA origin", async () => {
      const ipaCertifiedAttr1: Attribute = {
        ...baseAttribute(),
        kind: attributeKind.certified,
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "code-1",
      };
      const ipaCertifiedAttr2: Attribute = {
        ...baseAttribute(),
        kind: attributeKind.certified,
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "code-2",
      };
      const ipaDeclaredAttr: Attribute = {
        ...baseAttribute(),
        kind: attributeKind.declared,
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "code-3",
      };
      const nonIpaCertifiedAttr: Attribute = {
        ...baseAttribute(),
        kind: attributeKind.certified,
        origin: "ANAC",
        code: "code-4",
      };

      await upsertAttribute(readModelDB, ipaCertifiedAttr1, 0);
      await upsertAttribute(readModelDB, ipaCertifiedAttr2, 0);
      await upsertAttribute(readModelDB, ipaDeclaredAttr, 0);
      await upsertAttribute(readModelDB, nonIpaCertifiedAttr, 0);

      const attributes = await readModelServiceSQL.getAttributes();

      expect(attributes).toHaveLength(2);
      const ids = attributes.map((a) => a.id).sort();
      expect(ids).toEqual([ipaCertifiedAttr1.id, ipaCertifiedAttr2.id].sort());
    });

    it("should return an empty array when no matching attributes exist", async () => {
      await upsertAttribute(
        readModelDB,
        {
          ...baseAttribute(),
          kind: attributeKind.declared,
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          code: "code-declared",
        },
        0
      );

      const attributes = await readModelServiceSQL.getAttributes();

      expect(attributes).toHaveLength(0);
    });
  });

  describe("getTenantByExternalIdWithMetadata", () => {
    it("should return metadata when the tenant exists", async () => {
      const tenant: Tenant = {
        ...baseTenant(),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-ext-1",
        },
      };
      await upsertTenant(readModelDB, tenant, 7);

      const result =
        await readModelServiceSQL.getTenantByExternalIdWithMetadata({
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-ext-1",
        });

      expect(result).toEqual({ metadata: { version: 7 } });
    });

    it("should return undefined when the tenant does not exist", async () => {
      const result =
        await readModelServiceSQL.getTenantByExternalIdWithMetadata({
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "missing",
        });

      expect(result).toBeUndefined();
    });

    it("should match only tenants with the exact origin and value", async () => {
      await upsertTenant(
        readModelDB,
        {
          ...baseTenant(),
          id: unsafeBrandId(generateId()),
          externalId: {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
            value: "shared-value",
          },
        },
        0
      );
      await upsertTenant(
        readModelDB,
        {
          ...baseTenant(),
          id: unsafeBrandId(generateId()),
          externalId: { origin: "ANAC", value: "shared-value" },
        },
        0
      );

      const result =
        await readModelServiceSQL.getTenantByExternalIdWithMetadata({
          origin: "ANAC",
          value: "shared-value",
        });

      expect(result).toEqual({ metadata: { version: 0 } });
    });
  });
});
