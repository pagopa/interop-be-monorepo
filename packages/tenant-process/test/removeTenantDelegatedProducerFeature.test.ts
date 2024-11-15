/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedProducerFeatureRemovedV2,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import { tenantHasNoDelegatedProducerFeature } from "../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("removeTenantDelegatedProducerFeature", async () => {
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
          type: "DelegatedProducer",
          availabilityTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(mockTenant);
    await tenantService.removeTenantDelegatedProducerFeature({
      organizationId: mockTenant.id,
      correlationId: generateId(),
      authData: getMockAuthData(),
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
      type: "TenantDelegatedProducerFeatureRemoved",
      event_version: 2,
    });

    const writtenPayload: TenantDelegatedProducerFeatureRemovedV2 | undefined =
      protobufDecoder(TenantDelegatedProducerFeatureRemovedV2).parse(
        writtenEvent.data
      );

    const updatedTenant: Tenant = {
      ...mockTenant,
      features: [],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });

  it("Should throw tenantHasNoDelegatedProducerFeature if the requester tenant already has the delegated producer feature", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      features: [],
    };

    await addOneTenant(tenant);

    expect(
      tenantService.removeTenantDelegatedProducerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        authData: getMockAuthData(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantHasNoDelegatedProducerFeature(tenant.id));
  });
  it("Should throw operationForbidden if the requester tenant is not a public administration", async () => {
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
      tenantService.removeTenantDelegatedProducerFeature({
        organizationId: tenant.id,
        correlationId: generateId(),
        authData: {
          ...getMockAuthData(),
          externalId: { origin: "UNKNOWN", value: "test" },
        },
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
});