/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockContext,
  getMockTenant,
  getMockAuthData,
  getMockTenantMail,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  ContactId,
  generateId,
  Tenant,
  TenantContactAddedV3,
  protobufDecoder,
  operationForbidden,
  tenantKind,
  unsafeBrandId,
  TenantOnboardDetailsUpdatedV3,
  TenantOnboardedV3,
  toTenantV3,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  SCP,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import { selfcareIdConflict } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  contactDataManagerService,
  postgresDB,
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
      event_version: 3,
    });
    const writtenPayload: TenantOnboardDetailsUpdatedV3 | undefined =
      protobufDecoder(TenantOnboardDetailsUpdatedV3).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId,
      kind: tenantKind.PA,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      tenant: toTenantV3(updatedTenant),
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

      const writtenPayload: TenantOnboardedV3 | undefined = protobufDecoder(
        TenantOnboardedV3
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
        tenant: toTenantV3(expectedTenant),
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
    const writtenPayload = protobufDecoder(TenantOnboardedV3).parse(
      writtenEvent.data
    );

    expect(writtenEvent).toMatchObject({
      type: "TenantOnboarded",
      event_version: 3,
    });
    expect(writtenPayload.tenant?.contactId).toBeUndefined();
    expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
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
  it("Should convert a legacy tenant when updating it: TenantContactAdded, then TenantOnboardDetailsUpdated", async () => {
    const contactEmail = getMockTenantMail();
    const legacyTenant: Tenant = {
      ...getMockTenant(),
      mails: [contactEmail],
    };
    await addOneTenant(legacyTenant);
    const contactId = generateId<ContactId>();
    contactDataManagerService.createContact.mockResolvedValueOnce({
      type: "created",
      contactId,
    });
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: legacyTenant.externalId,
      name: legacyTenant.name,
      selfcareId: legacyTenant.selfcareId!,
      onboardedAt: legacyTenant.onboardedAt!.toISOString(),
      selfcareInstitutionType: legacyTenant.selfcareInstitutionType,
      subUnitType: legacyTenant.subUnitType,
    };

    await tenantService.selfcareUpsertTenant(
      tenantSeed,
      getMockContext({ authData: getMockAuthData(legacyTenant.id) })
    );

    expect(contactDataManagerService.createContact).toHaveBeenCalledWith(
      contactEmail.address,
      expect.anything()
    );

    const contactEvent = await readEventByStreamIdAndVersion(
      legacyTenant.id,
      1,
      "tenant",
      postgresDB
    );
    expect(contactEvent).toMatchObject({
      type: "TenantContactAdded",
      event_version: 3,
    });
    expect(
      protobufDecoder(TenantContactAddedV3).parse(contactEvent.data)
    ).toEqual({
      contactId,
      tenant: toTenantV3({
        ...legacyTenant,
        mails: [],
        contactId,
        updatedAt: new Date(),
      }),
    });

    const writtenEvent = await readLastTenantEvent(legacyTenant.id);
    expect(writtenEvent).toMatchObject({
      version: "2",
      type: "TenantOnboardDetailsUpdated",
      event_version: 3,
    });
    expect(
      protobufDecoder(TenantOnboardDetailsUpdatedV3).parse(writtenEvent.data)
    ).toEqual({
      tenant: toTenantV3({
        ...legacyTenant,
        mails: [],
        contactId,
        kind: tenantKind.PA,
        updatedAt: new Date(),
      }),
    });
  });
  it("Should not create a contact for a legacy tenant when the update is rejected", async () => {
    const legacyTenant: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    };
    await addOneTenant(legacyTenant);
    const newSelfcareId = generateId();

    await expect(
      tenantService.selfcareUpsertTenant(
        {
          externalId: legacyTenant.externalId,
          name: legacyTenant.name,
          selfcareId: newSelfcareId,
          onboardedAt: legacyTenant.onboardedAt!.toISOString(),
          selfcareInstitutionType: legacyTenant.selfcareInstitutionType,
        },
        getMockContext({ authData: getMockAuthData(legacyTenant.id) })
      )
    ).rejects.toThrowError(
      selfcareIdConflict({
        tenantId: legacyTenant.id,
        existingSelfcareId: legacyTenant.selfcareId!,
        newSelfcareId,
      })
    );

    expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
    const lastEvent = await readLastTenantEvent(legacyTenant.id);
    expect(lastEvent.version).toBe("0");
  });
});
