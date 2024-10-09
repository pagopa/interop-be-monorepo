/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedProducerFeatureAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockTenant } from "pagopa-interop-commons-test";
import { tenantHasAlreadyDelegatedProducerFeature } from "../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("assignTenantDelegatedProducerFeature", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should correctly assign the feature", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    await tenantService.assignTenantDelegatedProducerFeature({
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
      type: "TenantDelegatedProducerFeatureAdded",
      event_version: 2,
    });

    const writtenPayload: TenantDelegatedProducerFeatureAddedV2 | undefined =
      protobufDecoder(TenantDelegatedProducerFeatureAddedV2).parse(
        writtenEvent.data
      );

    const updatedTenant: Tenant = {
      ...mockTenant,
      features: [
        ...mockTenant.features,
        {
          type: "DelegatedProducer",
          availabilityTimestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });

  it("Should throw tenantHasAlreadyDelegatedProducerFeature if the requester tenant already has the delegated producer feature", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer",
          availabilityTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);
    expect(
      tenantService.assignTenantDelegatedProducerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantHasAlreadyDelegatedProducerFeature(tenant.id));
  });
});
