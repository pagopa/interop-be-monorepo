/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantUpdatedV2,
  Tenant,
  TenantFeature,
  protobufDecoder,
  tenantFeatureType,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import {
  getMockContextMaintenance,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";
import { getMockMaintenanceTenantUpdate } from "../mockUtils.js";

describe("maintenanceTenantUpdate", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the update of a tenant", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    const tenantUpdate = getMockMaintenanceTenantUpdate();
    await tenantService.maintenanceTenantUpdate(
      {
        tenantId: mockTenant.id,
        tenantUpdate,
        version: 0,
      },
      getMockContextMaintenance({})
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "MaintenanceTenantUpdated",
      event_version: 2,
    });
    const writtenPayload: MaintenanceTenantUpdatedV2 | undefined =
      protobufDecoder(MaintenanceTenantUpdatedV2).parse(writtenEvent.data);

    const updatedMockTenant: Tenant = {
      ...mockTenant,
      ...tenantUpdate,
      mails: tenantUpdate.mails.map((mail) => ({
        ...mail,
        createdAt: new Date(mail.createdAt),
      })),
      onboardedAt: new Date(tenantUpdate.onboardedAt),
      selfcareInstitutionType: tenantUpdate.selfcareInstitutionType,
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedMockTenant));
  });
  it("Should throw tenantNotFound when the tenant doesn't exists", async () => {
    const mockTenant = getMockTenant();
    const tenantUpdate = getMockMaintenanceTenantUpdate();

    expect(
      tenantService.maintenanceTenantUpdate(
        {
          tenantId: mockTenant.id,
          tenantUpdate,
          version: 0,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });

  it("should preserve existing features when 'features' is omitted from the update", async () => {
    const existingFeatures: TenantFeature[] = [
      {
        type: tenantFeatureType.delegatedConsumer,
        availabilityTimestamp: new Date(),
      },
    ];
    const mockTenant: Tenant = {
      ...getMockTenant(),
      features: existingFeatures,
    };
    await addOneTenant(mockTenant);

    const tenantUpdate = getMockMaintenanceTenantUpdate();
    await tenantService.maintenanceTenantUpdate(
      {
        tenantId: mockTenant.id,
        tenantUpdate,
        version: 0,
      },
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );
    const writtenPayload = protobufDecoder(MaintenanceTenantUpdatedV2).parse(
      writtenEvent.data
    );

    expect(writtenPayload.tenant?.features).toEqual(
      toTenantV2({ ...mockTenant, features: existingFeatures }).features
    );
  });

  it("should remove features when 'features' is set to empty array (GSP cleanup case)", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: tenantFeatureType.delegatedProducer,
          availabilityTimestamp: new Date(),
        },
        {
          type: tenantFeatureType.delegatedConsumer,
          availabilityTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(mockTenant);

    const tenantUpdate = {
      ...getMockMaintenanceTenantUpdate(),
      features: [],
    };
    await tenantService.maintenanceTenantUpdate(
      {
        tenantId: mockTenant.id,
        tenantUpdate,
        version: 0,
      },
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );
    const writtenPayload = protobufDecoder(MaintenanceTenantUpdatedV2).parse(
      writtenEvent.data
    );

    expect(writtenPayload.tenant?.features).toEqual([]);
  });

  it("should replace features when a new list is provided (round-trip for all variants)", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: tenantFeatureType.delegatedProducer,
          availabilityTimestamp: new Date("2024-01-01T00:00:00Z"),
        },
      ],
    };
    await addOneTenant(mockTenant);

    const newAvailabilityTimestamp = new Date("2026-04-13T10:00:00Z");
    const tenantUpdate = {
      ...getMockMaintenanceTenantUpdate(),
      features: [
        { certifier: { certifierId: "test-certifier-id" } },
        {
          delegatedProducer: {
            availabilityTimestamp: newAvailabilityTimestamp.toISOString(),
          },
        },
        {
          delegatedConsumer: {
            availabilityTimestamp: newAvailabilityTimestamp.toISOString(),
          },
        },
      ],
    };
    await tenantService.maintenanceTenantUpdate(
      {
        tenantId: mockTenant.id,
        tenantUpdate,
        version: 0,
      },
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );
    const writtenPayload = protobufDecoder(MaintenanceTenantUpdatedV2).parse(
      writtenEvent.data
    );

    const expectedFeatures: TenantFeature[] = [
      {
        type: tenantFeatureType.persistentCertifier,
        certifierId: "test-certifier-id",
      },
      {
        type: tenantFeatureType.delegatedProducer,
        availabilityTimestamp: newAvailabilityTimestamp,
      },
      {
        type: tenantFeatureType.delegatedConsumer,
        availabilityTimestamp: newAvailabilityTimestamp,
      },
    ];
    expect(writtenPayload.tenant?.features).toEqual(
      toTenantV2({ ...mockTenant, features: expectedFeatures }).features
    );
  });
});
