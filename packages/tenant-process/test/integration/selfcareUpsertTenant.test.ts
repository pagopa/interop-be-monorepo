/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockContext,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  protobufDecoder,
  operationForbidden,
  tenantKind,
  unsafeBrandId,
  TenantOnboardDetailsUpdatedV2,
  TenantOnboardedV2,
  TenantOnboardedV3,
  toTenantV2,
  toTenantV3,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  SCP,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import { config } from "../../src/config/config.js";
import { selfcareIdConflict } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  readLastTenantEvent,
  tenantService,
} from "../integrationUtils.js";

describe("selfcareUpsertTenant", async () => {
  const mockTenant = getMockTenant();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the tenant if it exists", async () => {
    await addOneTenant(mockTenant);
    const selfcareId = mockTenant.selfcareId!;
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: mockTenant.externalId.origin,
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId,
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      selfcareInstitutionType: mockTenant.selfcareInstitutionType,
      subUnitType: mockTenant.subUnitType,
    };
    await tenantService.selfcareUpsertTenant(
      tenantSeed,
      getMockContext({ authData: getMockAuthData(mockTenant.id) })
    );

    const writtenEvent = await readLastTenantEvent(mockTenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantOnboardDetailsUpdated",
    });
    const writtenPayload: TenantOnboardDetailsUpdatedV2 | undefined =
      protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId,
      kind: tenantKind.PA,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
    });
  });
  it.each([
    { origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER, type: "PA" },
    { origin: SCP, type: "SCP" },
    { origin: "PRV", type: "PRV" },
  ])(
    "Should create a tenant with origin $origin and type $type if it does not exist",
    async ({ origin, type }) => {
      const tenantSeed = {
        externalId: {
          origin,
          value: "0",
        },
        name: "A tenant",
        selfcareId: generateId(),
        onboardedAt: mockTenant.onboardedAt!.toISOString(),
        subUnitType: mockTenant.subUnitType,
        selfcareInstitutionType: type,
      };

      const id = await tenantService.selfcareUpsertTenant(
        tenantSeed,
        getMockContext({})
      );

      expect(id).toBeDefined();
      const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));
      if (!writtenEvent) {
        fail("Creation failed: tenant not found in event-store");
      }

      const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
        TenantOnboardedV2
      ).parse(writtenEvent.data);

      const expectedTenant: Tenant = {
        externalId: tenantSeed.externalId,
        id: unsafeBrandId(id),

        kind: match(type)
          .with("SCP", () => tenantKind.SCP)
          .with("PA", () => undefined)
          .otherwise(() => tenantKind.PRIVATE),
        selfcareId: tenantSeed.selfcareId,
        onboardedAt: mockTenant.onboardedAt!,
        selfcareInstitutionType: tenantSeed.selfcareInstitutionType,
        createdAt: new Date(),
        name: tenantSeed.name,
        attributes: [],
        features: [],
        mails: [],
      };

      expect(writtenPayload).toEqual({
        tenant: toTenantV2(expectedTenant),
      });
    }
  );
  it("Should ignore the deprecated digitalAddress when creating the tenant", async () => {
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: "PRV",
        value: generateId(),
      },
      name: "A tenant",
      selfcareId: generateId(),
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      selfcareInstitutionType: "PRV",
      digitalAddress: {
        kind: tenantApi.MailKind.Values.DIGITAL_ADDRESS,
        description: "Domicilio digitale",
        address: "tenant@pec.example.com",
      },
    };

    const id = await tenantService.selfcareUpsertTenant(
      tenantSeed,
      getMockContext({})
    );

    const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));
    const writtenPayload = protobufDecoder(TenantOnboardedV2).parse(
      writtenEvent.data
    );

    expect(writtenEvent).toMatchObject({
      type: "TenantOnboarded",
      event_version: 2,
    });
    expect(writtenPayload.tenant?.mails).toEqual([]);
  });
  it("should throw operation forbidden if role isn't internal and the requester is another tenant", async () => {
    await addOneTenant(mockTenant);
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: "IPA",
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId: mockTenant.selfcareId!,
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      subUnitType: mockTenant.subUnitType,
      selfcareInstitutionType: mockTenant.selfcareInstitutionType,
    };
    expect(
      tenantService.selfcareUpsertTenant(tenantSeed, getMockContext({}))
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw selfcareIdConflict error if the given and existing selfcareId differ", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    const newTenantSeed = {
      name: mockTenant.name,
      externalId: {
        origin: "IPA",
        value: mockTenant.externalId.value,
      },
      selfcareId: generateId(),
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      subUnitType: mockTenant.subUnitType,
      selfcareInstitutionType: mockTenant.selfcareInstitutionType,
    };
    expect(
      tenantService.selfcareUpsertTenant(
        newTenantSeed,
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(
      selfcareIdConflict({
        tenantId: mockTenant.id,
        existingSelfcareId: mockTenant.selfcareId!,
        newSelfcareId: newTenantSeed.selfcareId,
      })
    );
  });
  it("Should create the tenant with a V3 event and without mails when tenant events V3 are enabled", async () => {
    (config as Record<string, unknown>).featureFlagTenantEventsV3 = true;

    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: "PRV",
        value: generateId(),
      },
      name: "A tenant",
      selfcareId: generateId(),
      onboardedAt: mockTenant.onboardedAt!.toISOString(),
      selfcareInstitutionType: "PRV",
    };

    const id = await tenantService.selfcareUpsertTenant(
      tenantSeed,
      getMockContext({})
    );

    const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));

    expect(writtenEvent).toMatchObject({
      stream_id: id,
      version: "0",
      type: "TenantOnboarded",
      event_version: 3,
    });

    const writtenPayload: TenantOnboardedV3 | undefined = protobufDecoder(
      TenantOnboardedV3
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      externalId: tenantSeed.externalId,
      id: unsafeBrandId(id),
      kind: tenantKind.PRIVATE,
      selfcareId: tenantSeed.selfcareId,
      onboardedAt: mockTenant.onboardedAt!,
      selfcareInstitutionType: tenantSeed.selfcareInstitutionType,
      createdAt: new Date(),
      name: tenantSeed.name,
      attributes: [],
      features: [],
      mails: [],
    };

    expect(writtenPayload).toEqual({
      tenant: toTenantV3(expectedTenant),
    });

    (config as Record<string, unknown>).featureFlagTenantEventsV3 = false;
  });
});
