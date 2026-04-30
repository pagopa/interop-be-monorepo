/* eslint-disable functional/immutable-data */
import { Tenant } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  tenantKindHistoryDB,
  tenantKindHistoryWriterService,
} from "./utils.js";
import { getMockTenant } from "pagopa-interop-commons-test";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { asc, desc, eq } from "drizzle-orm";

describe("tenantKindHistory Writer Service", () => {
  it("writes history only when there is a tenant kind change", async () => {
    const tenant: Tenant = getMockTenant();

    await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
      tenant.id,
      0,
      "PA",
      new Date()
    );

    const result = await tenantKindHistoryDB
      .select()
      .from(tenantKindHistory)
      .where(eq(tenantKindHistory.tenantId, tenant.id))
      .limit(1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tenantId: tenant.id,
      kind: "PA",
      metadataVersion: 0,
    });

    await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
      tenant.id,
      1,
      "PA",
      new Date()
    );

    const resultAfterWrite = await tenantKindHistoryDB
      .select()
      .from(tenantKindHistory)
      .where(eq(tenantKindHistory.tenantId, tenant.id));

    expect(resultAfterWrite).toHaveLength(1);
    expect(resultAfterWrite[0]).toMatchObject({
      tenantId: tenant.id,
      kind: "PA",
      metadataVersion: 0,
    });

    await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
      tenant.id,
      2,
      "PRIVATE",
      new Date()
    );

    const change = await tenantKindHistoryDB
      .select()
      .from(tenantKindHistory)
      .where(eq(tenantKindHistory.tenantId, tenant.id))
      .orderBy(desc(tenantKindHistory.metadataVersion));

    expect(change).toHaveLength(2);
    expect(change[0]).toMatchObject({
      tenantId: tenant.id,
      kind: "PRIVATE",
      metadataVersion: 2,
    });

    await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
      tenant.id,
      3,
      "PA",
      new Date()
    );

    const backToFirst = await tenantKindHistoryDB
      .select()
      .from(tenantKindHistory)
      .where(eq(tenantKindHistory.tenantId, tenant.id))
      .orderBy(asc(tenantKindHistory.metadataVersion));

    expect(backToFirst).toHaveLength(3);
    expect(backToFirst[0]).toMatchObject({
      tenantId: tenant.id,
      kind: "PA",
      metadataVersion: 0,
    });
  });
});
