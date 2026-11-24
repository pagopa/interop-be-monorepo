/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAttribute,
  getMockAuthData,
  getMockContext,
  getMockContextInternal,
  getMockContextMaintenance,
  getMockTenant,
  getMockTenantMail,
  ReadEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  attributeKind,
  ContactId,
  CorrelationId,
  generateId,
  protobufDecoder,
  Tenant,
  tenantAttributeType,
  TenantCertifiedAttributeAssignedV3,
  TenantContactAddedV3,
  TenantDeclaredAttributeAssignedV3,
  TenantEvent,
  TenantKindUpdatedV3,
  tenantKind,
  TenantMail,
  tenantMailKind,
  toTenantV3,
  WithMetadata,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from "vitest";

import {
  certifiedAttributeAlreadyAssigned,
  contactCreationFailed,
} from "../../src/model/domain/errors.js";
import { ContactDataManagerService } from "../../src/services/contactDataManagerService.js";
import { convertLegacyTenant } from "../../src/services/legacyTenantConversion.js";
import {
  addOneAttribute,
  addOneTenant,
  contactDataManagerService,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

const mailOfKind = (
  kind: TenantMail["kind"],
  createdAt: Date,
  address: string
): TenantMail => ({ ...getMockTenantMail(kind), createdAt, address });

describe("Legacy tenant conversion", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("tenant operations", () => {
    const declaredAttribute = getMockAttribute(attributeKind.declared);
    const certifiedAttribute = getMockAttribute(attributeKind.certified);

    const addDeclaredAttribute = (
      tenant: Tenant
    ): Promise<WithMetadata<Tenant>> =>
      tenantService.addDeclaredAttribute(
        { tenantAttributeSeed: { id: declaredAttribute.id } },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      );

    const tenantWithDeclaredAttribute = (tenant: Tenant): Tenant => ({
      ...tenant,
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    });

    it("Should create the contact from the most recent contact email, then write the operation event", async () => {
      const latestContactEmail = mailOfKind(
        tenantMailKind.ContactEmail,
        new Date("2025-06-01"),
        "latest@test.it"
      );
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
        mails: [
          mailOfKind(
            tenantMailKind.ContactEmail,
            new Date("2024-06-01"),
            "older@test.it"
          ),
          latestContactEmail,
          mailOfKind(
            tenantMailKind.DigitalAddress,
            new Date("2025-12-01"),
            "pec@test.it"
          ),
        ],
      };
      await addOneAttribute(declaredAttribute);
      await addOneTenant(legacyTenant);
      const contactId = generateId<ContactId>();
      contactDataManagerService.createContact.mockResolvedValueOnce({
        type: "created",
        contactId,
      });

      const returnedTenant = await addDeclaredAttribute(legacyTenant);

      expect(contactDataManagerService.createContact).toHaveBeenCalledOnce();
      expect(contactDataManagerService.createContact).toHaveBeenCalledWith(
        latestContactEmail.address,
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

      const expectedTenant: Tenant = {
        ...tenantWithDeclaredAttribute(legacyTenant),
        mails: [],
        contactId,
      };
      const operationEvent = await readLastEventByStreamId(
        legacyTenant.id,
        "tenant",
        postgresDB
      );
      expect(operationEvent).toMatchObject({
        version: "2",
        type: "TenantDeclaredAttributeAssigned",
        event_version: 3,
      });
      expect(
        protobufDecoder(TenantDeclaredAttributeAssignedV3).parse(
          operationEvent.data
        )
      ).toEqual({
        attributeId: declaredAttribute.id,
        tenant: toTenantV3(expectedTenant),
      });
      expect(returnedTenant).toEqual({
        data: expectedTenant,
        metadata: { version: 2 },
      });
    });

    it("Should remove the mails without a contact when the contact email is rejected", async () => {
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneAttribute(declaredAttribute);
      await addOneTenant(legacyTenant);
      contactDataManagerService.createContact.mockResolvedValueOnce({
        type: "invalidEmail",
      });

      const returnedTenant = await addDeclaredAttribute(legacyTenant);

      expect(contactDataManagerService.createContact).toHaveBeenCalledOnce();

      const expectedTenant: Tenant = {
        ...tenantWithDeclaredAttribute(legacyTenant),
        mails: [],
      };
      const writtenEvent = await readLastEventByStreamId(
        legacyTenant.id,
        "tenant",
        postgresDB
      );
      expect(writtenEvent).toMatchObject({
        version: "1",
        type: "TenantDeclaredAttributeAssigned",
        event_version: 3,
      });
      expect(
        protobufDecoder(TenantDeclaredAttributeAssignedV3).parse(
          writtenEvent.data
        )
      ).toEqual({
        attributeId: declaredAttribute.id,
        tenant: toTenantV3(expectedTenant),
      });
      expect(returnedTenant).toEqual({
        data: expectedTenant,
        metadata: { version: 1 },
      });
    });

    it("Should remove the mails without calling the Contact Data Manager when the tenant has only a digital address", async () => {
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
        mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
      };
      await addOneAttribute(declaredAttribute);
      await addOneTenant(legacyTenant);

      const returnedTenant = await addDeclaredAttribute(legacyTenant);

      expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
      expect(returnedTenant).toEqual({
        data: { ...tenantWithDeclaredAttribute(legacyTenant), mails: [] },
        metadata: { version: 1 },
      });
    });

    it("Should not write any event when the contact creation fails", async () => {
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneAttribute(declaredAttribute);
      await addOneTenant(legacyTenant);
      const error = contactCreationFailed({
        type: "errorResponse",
        status: 503,
      });
      contactDataManagerService.createContact.mockRejectedValueOnce(error);

      await expect(addDeclaredAttribute(legacyTenant)).rejects.toThrowError(
        error
      );

      const lastEvent = await readLastEventByStreamId(
        legacyTenant.id,
        "tenant",
        postgresDB
      );
      expect(lastEvent).toMatchObject({
        version: "0",
        type: "TenantOnboarded",
      });
    });

    it("Should not create a contact when the operation is rejected by its validations", async () => {
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            id: certifiedAttribute.id,
            type: tenantAttributeType.CERTIFIED,
            assignmentTimestamp: new Date(),
          },
        ],
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneAttribute(certifiedAttribute);
      await addOneTenant(legacyTenant);

      await expect(
        tenantService.internalAssignCertifiedAttribute(
          {
            tenantOrigin: legacyTenant.externalId.origin,
            tenantExternalId: legacyTenant.externalId.value,
            attributeOrigin: certifiedAttribute.origin!,
            attributeExternalId: certifiedAttribute.code!,
          },
          getMockContextInternal({})
        )
      ).rejects.toThrowError(
        certifiedAttributeAlreadyAssigned(
          certifiedAttribute.id,
          legacyTenant.id
        )
      );

      expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
    });

    it("Should not create a contact when the operation writes nothing", async () => {
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        remoteIds: undefined,
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneTenant(legacyTenant);

      await tenantService.maintenanceTenantDeleteRemoteId(
        { tenantId: legacyTenant.id, origin: "ANY" },
        getMockContextMaintenance({})
      );

      expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
      const lastEvent = await readLastEventByStreamId(
        legacyTenant.id,
        "tenant",
        postgresDB
      );
      expect(lastEvent.version).toBe("0");
    });

    it("Should keep the versions contiguous when the operation writes more events", async () => {
      // No kind: the assignment writes TenantKindUpdated too
      const legacyTenant: Tenant = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneAttribute(certifiedAttribute);
      await addOneTenant(legacyTenant);
      const contactId = generateId<ContactId>();
      contactDataManagerService.createContact.mockResolvedValueOnce({
        type: "created",
        contactId,
      });

      await tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: legacyTenant.externalId.origin,
          tenantExternalId: legacyTenant.externalId.value,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
        },
        getMockContextInternal({})
      );

      const readEvent = (version: number): Promise<ReadEvent<TenantEvent>> =>
        readEventByStreamIdAndVersion(
          legacyTenant.id,
          version,
          "tenant",
          postgresDB
        );

      const contactEvent = await readEvent(1);
      expect(contactEvent).toMatchObject({
        type: "TenantContactAdded",
        event_version: 3,
      });

      const assignedEvent = await readEvent(2);
      expect(assignedEvent).toMatchObject({
        type: "TenantCertifiedAttributeAssigned",
        event_version: 3,
      });
      const assignedPayload = protobufDecoder(
        TenantCertifiedAttributeAssignedV3
      ).parse(assignedEvent.data);
      expect(assignedPayload.tenant?.contactId).toBe(contactId);

      const kindEvent = await readEvent(3);
      expect(kindEvent).toMatchObject({
        type: "TenantKindUpdated",
        event_version: 3,
      });
      const kindPayload = protobufDecoder(TenantKindUpdatedV3).parse(
        kindEvent.data
      );
      expect(kindPayload.tenant?.contactId).toBe(contactId);

      const lastEvent = await readLastEventByStreamId(
        legacyTenant.id,
        "tenant",
        postgresDB
      );
      expect(lastEvent.version).toBe("3");
    });
  });

  describe("convertLegacyTenant", () => {
    const ctx = {
      correlationId: generateId<CorrelationId>(),
      logger: genericLogger,
    };

    const fakeContactDataManager = (): {
      createContact: Mock<ContactDataManagerService["createContact"]>;
    } => ({
      createContact: vi.fn<ContactDataManagerService["createContact"]>(),
    });

    it("Should leave a tenant without mails as it is", async () => {
      const service = fakeContactDataManager();
      const tenant = { data: getMockTenant(), metadata: { version: 4 } };

      const conversion = await convertLegacyTenant(tenant, service, ctx);

      expect(conversion.tenant).toBe(tenant);
      expect(conversion.events).toEqual([]);
      expect(service.createContact).not.toHaveBeenCalled();
    });

    it("Should create the contact and the TenantContactAdded event at the current version", async () => {
      const service = fakeContactDataManager();
      const contactId = generateId<ContactId>();
      service.createContact.mockResolvedValueOnce({
        type: "created",
        contactId,
      });
      const contactEmail = getMockTenantMail(tenantMailKind.ContactEmail);
      const tenant = {
        data: { ...getMockTenant(), mails: [contactEmail] },
        metadata: { version: 4 },
      };

      const conversion = await convertLegacyTenant(tenant, service, ctx);

      expect(service.createContact).toHaveBeenCalledWith(
        contactEmail.address,
        ctx
      );
      expect(conversion.tenant).toEqual({
        data: {
          ...tenant.data,
          mails: [],
          contactId,
          updatedAt: new Date(),
        },
        metadata: { version: 5 },
      });
      expect(conversion.events).toEqual([
        expect.objectContaining({
          streamId: tenant.data.id,
          version: 4,
          event: expect.objectContaining({
            type: "TenantContactAdded",
            event_version: 3,
          }),
        }),
      ]);
      expect(conversion.convert(tenant.data)).toEqual({
        ...tenant.data,
        mails: [],
        contactId,
      });
    });

    it("Should keep the contact of a tenant that has mails too, without creating another one", async () => {
      const service = fakeContactDataManager();
      const contactId = generateId<ContactId>();
      const tenant = {
        data: {
          ...getMockTenant(),
          contactId,
          mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
        },
        metadata: { version: 4 },
      };

      const conversion = await convertLegacyTenant(tenant, service, ctx);

      expect(service.createContact).not.toHaveBeenCalled();
      expect(conversion.events).toEqual([]);
      expect(conversion.tenant).toEqual({
        data: { ...tenant.data, mails: [] },
        metadata: { version: 4 },
      });
    });

    it("Should remove the mails without a contact when the tenant has only a digital address", async () => {
      const service = fakeContactDataManager();
      const tenant = {
        data: {
          ...getMockTenant(),
          mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
        },
        metadata: { version: 2 },
      };

      const conversion = await convertLegacyTenant(tenant, service, ctx);

      expect(service.createContact).not.toHaveBeenCalled();
      expect(conversion.events).toEqual([]);
      expect(conversion.tenant).toEqual({
        data: { ...tenant.data, mails: [] },
        metadata: { version: 2 },
      });
    });
  });
});
