/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantId,
  TenantDelegatedConsumerFeatureAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { getMockAuthData, getMockTenant } from "pagopa-interop-commons-test";
import {
  tenantAlreadyHasFeature,
  tenantIsNotIPA,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("assignTenantDelegatedConsumerFeature", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should correctly assign the feature", async () => {
    const mockTenant: Tenant = getMockTenant();
    await addOneTenant(mockTenant);
    await tenantService.assignTenantDelegatedConsumerFeature({
      authData: getMockAuthData(mockTenant.id),
      serviceName: "TenantService",
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
      type: "TenantDelegatedConsumerFeatureAdded",
      event_version: 2,
    });

    const writtenPayload: TenantDelegatedConsumerFeatureAddedV2 | undefined =
      protobufDecoder(TenantDelegatedConsumerFeatureAddedV2).parse(
        writtenEvent.data
      );

    const updatedTenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "DelegatedConsumer",
          availabilityTimestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw tenantNotFound if the requester tenant doesn't exist", async () => {
    const organizationId = generateId<TenantId>();
    expect(
      tenantService.assignTenantDelegatedConsumerFeature({
        authData: getMockAuthData(organizationId),
        serviceName: "TenantService",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(organizationId));
  });
  it("Should throw tenantAlreadyHasFeature if the requester tenant already has the delegated consumer feature", async () => {
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

    expect(
      tenantService.assignTenantDelegatedConsumerFeature({
        authData: getMockAuthData(mockTenant.id),
        serviceName: "TenantService",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantAlreadyHasFeature(mockTenant.id, "DelegatedConsumer")
    );
  });
  it("Should throw tenantIsNotIPA if the requester tenant is not a public administration", async () => {
    const organizationId = generateId<TenantId>();

    expect(
      tenantService.assignTenantDelegatedConsumerFeature({
        authData: {
          ...getMockAuthData(organizationId),
          externalId: { origin: "UNKNOWN", value: "test" },
        },
        serviceName: "TenantService",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantIsNotIPA(organizationId));
  });
});