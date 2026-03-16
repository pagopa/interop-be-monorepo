/* eslint-disable functional/immutable-data */
import {
  Tenant,
  TenantCreatedV1,
  TenantEventEnvelope,
  TenantEventEnvelopeV2,
  TenantOnboardedV2,
  toTenantV2,
} from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  tenantKindHistoryDB,
  tenantKindHistoryWriterService,
} from "./utils.js";
import { getMockTenant, toTenantV1 } from "pagopa-interop-commons-test";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { desc, eq } from "drizzle-orm";
import { tenantKindhistoryConsumerServiceBuilder } from "../src/tenantKindHistoryConsumerService.js";
import { TenantKindHistoryWriterService } from "../src/tenantKindHistoryWriterService.js";
import { Logger } from "pagopa-interop-commons";

describe("tenantKindHistory Consumer Service", async () => {
  const mockedWriter: TenantKindHistoryWriterService = {
    createTenantKindHistory: vi.fn(),
  } as unknown as TenantKindHistoryWriterService;
  const consumerService = tenantKindhistoryConsumerServiceBuilder(mockedWriter);

  const mockedLogger = {
    info() {
      /* empty */
    },
  } as unknown as Logger;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls tenantKindHistory Writer Service", async () => {
    const mockTenant = getMockTenant();
    mockTenant.kind = "PA";

    const payload: TenantCreatedV1 = {
      tenant: toTenantV1(mockTenant),
    };

    const message: TenantEventEnvelope = {
      sequence_num: 1,
      stream_id: mockTenant.id,
      version: 1,
      type: "TenantCreated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };
    await consumerService.handleMessageV1(message, mockedLogger);

    expect(mockedWriter.createTenantKindHistory).toHaveBeenCalled();
    expect(mockedWriter.createTenantKindHistory).toHaveBeenCalledWith(
      message.data.tenant!.id,
      1,
      "PA",
      message.log_date
    );

    //V2 event
    const mockMessage: Omit<TenantEventEnvelopeV2, "type" | "data"> = {
      event_version: 2,
      stream_id: mockTenant.id,
      version: 2,
      sequence_num: 1,
      log_date: new Date(),
    };

    const tenant: Tenant = {
      ...mockTenant,
      onboardedAt: new Date(),
      kind: "PRIVATE",
    };

    const payloadv2: TenantOnboardedV2 = {
      tenant: toTenantV2(tenant),
    };

    const messagev2: TenantEventEnvelopeV2 = {
      ...mockMessage,
      type: "TenantOnboarded",
      data: payloadv2,
    };

    await consumerService.handleMessageV2(messagev2, mockedLogger);

    expect(mockedWriter.createTenantKindHistory).toHaveBeenCalledTimes(2);
    expect(mockedWriter.createTenantKindHistory).toHaveBeenLastCalledWith(
      messagev2.data.tenant!.id,
      2,
      "PRIVATE",
      messagev2.log_date
    );
  });
});

describe("tenantKindHistory Writer Service", async () => {
  it("writes history only when there is a tenant kind change", async () => {
    const tenant: Tenant = getMockTenant();

    await tenantKindHistoryWriterService.createTenantKindHistory(
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

    await tenantKindHistoryWriterService.createTenantKindHistory(
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

    await tenantKindHistoryWriterService.createTenantKindHistory(
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

    await tenantKindHistoryWriterService.createTenantKindHistory(
      tenant.id,
      3,
      "PA",
      new Date()
    );

    const backToFirst = await tenantKindHistoryDB
      .select()
      .from(tenantKindHistory)
      .where(eq(tenantKindHistory.tenantId, tenant.id));

    expect(backToFirst).toHaveLength(3);
    expect(backToFirst[0]).toMatchObject({
      tenantId: tenant.id,
      kind: "PA",
      metadataVersion: 0,
    });
  });
});
