/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  TenantDelegatedProducerFeatureAddedV2,
  TenantId,
  operationForbidden,
  TenantDelegatedProducerFeatureRemovedV2,
  TenantDelegatedConsumerFeatureRemovedV2,
  TenantDelegatedConsumerFeatureAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import {
  getRandomAuthData,
  getMockTenant,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import { tenantNotFound } from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { addOneTenant, postgresDB, tenantService } from "./utils.js";

describe("updateTenantDelegatedFeatures", async () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  config.delegationsAllowedOrigins = ["IPA", "TEST"];
  it.each(config.delegationsAllowedOrigins)(
    "Should correctly add Consumer feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: true,
          isDelegatedProducerFeatureEnabled: false,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
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

      const writtenPayload = protobufDecoder(
        TenantDelegatedConsumerFeatureAddedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [
          ...mockTenant.features,
          {
            type: "DelegatedConsumer",
            availabilityTimestamp: new Date(),
          },
        ],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it.each(config.delegationsAllowedOrigins)(
    "Should correctly add Producer feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: false,
          isDelegatedProducerFeatureEnabled: true,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
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

      const writtenPayload = protobufDecoder(
        TenantDelegatedProducerFeatureAddedV2
      ).parse(writtenEvent.data);

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
    }
  );

  it.each(config.delegationsAllowedOrigins)(
    "Should correctly remove Consumer feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
        features: [
          {
            type: "DelegatedConsumer",
            availabilityTimestamp: new Date(),
          },
        ],
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: false,
          isDelegatedProducerFeatureEnabled: false,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
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

      const writtenPayload = protobufDecoder(
        TenantDelegatedConsumerFeatureRemovedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it.each(config.delegationsAllowedOrigins)(
    "Should correctly remove Producer feature (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
        features: [
          {
            type: "DelegatedProducer",
            availabilityTimestamp: new Date(),
          },
        ],
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: false,
          isDelegatedProducerFeatureEnabled: false,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
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

      const writtenPayload = protobufDecoder(
        TenantDelegatedProducerFeatureRemovedV2
      ).parse(writtenEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [],
        updatedAt: new Date(),
      };

      expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it.each(config.delegationsAllowedOrigins)(
    "Should correctly add both Consumer and Producer features (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: true,
          isDelegatedProducerFeatureEnabled: true,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
        logger: genericLogger,
      });

      const consumerEvent = await readEventByStreamIdAndVersion(
        mockTenant.id,
        1,
        "tenant",
        postgresDB
      );

      expect(consumerEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "TenantDelegatedConsumerFeatureAdded",
        event_version: 2,
      });

      const producerEvent = await readEventByStreamIdAndVersion(
        mockTenant.id,
        2,
        "tenant",
        postgresDB
      );

      expect(producerEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "2",
        type: "TenantDelegatedProducerFeatureAdded",
        event_version: 2,
      });

      const lastUpdatedPayload = protobufDecoder(
        TenantDelegatedProducerFeatureAddedV2
      ).parse(producerEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [
          ...mockTenant.features,
          {
            type: "DelegatedConsumer",
            availabilityTimestamp: new Date(),
          },
          {
            type: "DelegatedProducer",
            availabilityTimestamp: new Date(),
          },
        ],
        updatedAt: new Date(),
      };

      expect(lastUpdatedPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it.each(config.delegationsAllowedOrigins)(
    "Should correctly remove both Consumer and Producer features (origin: %s)",
    async (origin) => {
      const mockTenant: Tenant = {
        ...getMockTenant(),
        externalId: {
          value: generateId(),
          origin,
        },
        features: [
          {
            type: "DelegatedConsumer",
            availabilityTimestamp: new Date(),
          },
          {
            type: "DelegatedProducer",
            availabilityTimestamp: new Date(),
          },
        ],
      };

      await addOneTenant(mockTenant);
      await tenantService.updateTenantDelegatedFeatures({
        organizationId: mockTenant.id,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: false,
          isDelegatedProducerFeatureEnabled: false,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
        logger: genericLogger,
      });

      const consumerEvent = await readEventByStreamIdAndVersion(
        mockTenant.id,
        1,
        "tenant",
        postgresDB
      );

      expect(consumerEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "1",
        type: "TenantDelegatedConsumerFeatureRemoved",
        event_version: 2,
      });

      const producerEvent = await readEventByStreamIdAndVersion(
        mockTenant.id,
        2,
        "tenant",
        postgresDB
      );

      expect(producerEvent).toMatchObject({
        stream_id: mockTenant.id,
        version: "2",
        type: "TenantDelegatedProducerFeatureRemoved",
        event_version: 2,
      });

      const lastUpdatedPayload = protobufDecoder(
        TenantDelegatedProducerFeatureRemovedV2
      ).parse(producerEvent.data);

      const updatedTenant: Tenant = {
        ...mockTenant,
        features: [],
        updatedAt: new Date(),
      };

      expect(lastUpdatedPayload.tenant).toEqual(toTenantV2(updatedTenant));
    }
  );

  it("Should throw tenantNotFound if the requester tenant doesn't exist", async () => {
    const organizationId = generateId<TenantId>();
    expect(
      tenantService.updateTenantDelegatedFeatures({
        organizationId,
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: true,
          isDelegatedProducerFeatureEnabled: true,
        },
        correlationId: generateId(),
        authData: getRandomAuthData(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(organizationId));
  });
  it("Should throw operationForbidden if the requester tenant has externalId origin not compliant", async () => {
    const tenant = getMockTenant();

    await addOneTenant(tenant);

    expect(
      tenantService.updateTenantDelegatedFeatures({
        organizationId: tenant.id,
        correlationId: generateId(),
        tenantFeatures: {
          isDelegatedConsumerFeatureEnabled: true,
          isDelegatedProducerFeatureEnabled: true,
        },
        authData: {
          ...getRandomAuthData(tenant.id),
          externalId: { origin: "UNKNOWN", value: "test" },
        },
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
});
