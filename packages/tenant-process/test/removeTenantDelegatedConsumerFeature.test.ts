/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedConsumerFeatureRemovedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockTenant } from "pagopa-interop-commons-test";
import { tenantDoesNotHaveFeature } from "../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("removeTenantDelegatedConsumerFeature", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should correctly remove the feature", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedConsumer",
          availabilityTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(mockTenant);
    await tenantService.removeTenantDelegatedConsumerFeature({
      organizationId: mockTenant.id,
      correlationId: generateId(),
      logger: genericLogger,
    });
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantDelegatedConsumerFeatureRemoved",
      event_version: 2,
    });

    const writtenPayload: TenantDelegatedConsumerFeatureRemovedV2 | undefined =
      protobufDecoder(TenantDelegatedConsumerFeatureRemovedV2).parse(
        writtenEvent.data
      );

    const updatedTenant: Tenant = {
      ...mockTenant,
      features: [],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });

  it("Should throw tenantHasNoDelegatedConsumerFeature if the requester tenant already has the delegated Consumer feature", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [],
    };

    await addOneTenant(tenant);

    expect(
      tenantService.removeTenantDelegatedConsumerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantDoesNotHaveFeature(tenant.id, "DelegatedConsumer")
    );
  });
});
