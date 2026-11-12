import { asc, eq } from "drizzle-orm";
import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  ContactId,
  Tenant,
  TenantEventEnvelopeV3,
  TenantOnboardedV3,
  generateId,
  missingKafkaMessageDataError,
  tenantKind,
  toTenantV3,
} from "pagopa-interop-models";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { describe, expect, it } from "vitest";

import { handleMessageV3 } from "../src/tenantKindHistoryConsumerService.js";
import {
  tenantKindHistoryDB,
  tenantKindHistoryWriterService,
} from "./utils.js";

const getTenantKindHistory = async (
  tenantId: string
): Promise<Array<typeof tenantKindHistory.$inferSelect>> =>
  tenantKindHistoryDB
    .select()
    .from(tenantKindHistory)
    .where(eq(tenantKindHistory.tenantId, tenantId))
    .orderBy(asc(tenantKindHistory.metadataVersion));

describe("handleMessageV3", () => {
  it.each([
    "TenantOnboarded",
    "TenantOnboardDetailsUpdated",
    "MaintenanceTenantUpdated",
  ] as const)("writes the tenant kind on %s", async (type) => {
    const tenant: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    await handleMessageV3(
      {
        sequence_num: 1,
        stream_id: tenant.id,
        version: 1,
        type,
        event_version: 3,
        data: { tenant: toTenantV3(tenant) },
        log_date: new Date(),
      },
      tenantKindHistoryWriterService,
      genericLogger
    );

    const history = await getTenantKindHistory(tenant.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      tenantId: tenant.id,
      kind: tenantKind.PA,
      metadataVersion: 1,
    });
  });

  it("writes the new tenant kind on TenantKindUpdated", async () => {
    const tenant: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

    await handleMessageV3(
      {
        sequence_num: 1,
        stream_id: tenant.id,
        version: 1,
        type: "TenantOnboarded",
        event_version: 3,
        data: { tenant: toTenantV3(tenant) },
        log_date: new Date(),
      },
      tenantKindHistoryWriterService,
      genericLogger
    );
    await handleMessageV3(
      {
        sequence_num: 2,
        stream_id: tenant.id,
        version: 2,
        type: "TenantKindUpdated",
        event_version: 3,
        data: {
          tenant: toTenantV3({ ...tenant, kind: tenantKind.GSP }),
        },
        log_date: new Date(),
      },
      tenantKindHistoryWriterService,
      genericLogger
    );

    const history = await getTenantKindHistory(tenant.id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      tenantId: tenant.id,
      kind: tenantKind.GSP,
      metadataVersion: 2,
    });
  });

  it.each(["TenantContactAdded", "TenantContactDeleted"] as const)(
    "ignores %s",
    async (type) => {
      const contactId = generateId<ContactId>();
      const tenant: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      await handleMessageV3(
        {
          sequence_num: 1,
          stream_id: tenant.id,
          version: 1,
          type,
          event_version: 3,
          data: {
            contactId,
            tenant: toTenantV3({ ...tenant, contactId }),
          },
          log_date: new Date(),
        },
        tenantKindHistoryWriterService,
        genericLogger
      );

      const history = await getTenantKindHistory(tenant.id);
      expect(history).toHaveLength(0);
    }
  );

  it("throws missingKafkaMessageDataError when the tenant is missing", async () => {
    const message: TenantEventEnvelopeV3 = {
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      type: "TenantOnboarded",
      event_version: 3,
      data: {} as unknown as TenantOnboardedV3,
      log_date: new Date(),
    };

    await expect(
      handleMessageV3(message, tenantKindHistoryWriterService, genericLogger)
    ).rejects.toThrowError(
      missingKafkaMessageDataError("tenant", "TenantOnboarded")
    );
  });
});
