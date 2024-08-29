/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { fail } from "assert";
import { describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  Tenant,
  TenantOnboardDetailsUpdatedV2,
  TenantOnboardedV2,
  TenantVerifiedAttributeExpirationUpdatedV2,
  TenantVerifiedAttributeExtensionUpdatedV2,
  descriptorState,
  generateId,
  operationForbidden,
  protobufDecoder,
  tenantKind,
  toTenantV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  selfcareIdConflict,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  expirationDateNotFoundInVerifier,
  tenantNotFoundBySelfcareId,
  tenantNotFoundByExternalId,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  currentDate,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
  readLastTenantEvent,
  readModelService,
  tenantService,
} from "./utils.js";

describe("Integration tests", () => {
  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe("tenantService", () => {
    describe("selfcareUpsertTenant", async () => {
      const correlationId = generateId();

      it("should update the tenant if it exists", async () => {
        const mockTenant = { ...getMockTenant(), kind: tenantKind.PA };
        await addOneTenant(mockTenant);
        const selfcareId = mockTenant.selfcareId!;
        const tenantSeed: tenantApi.SelfcareTenantSeed = {
          externalId: {
            origin: mockTenant.externalId.origin,
            value: mockTenant.externalId.value,
          },
          name: "A tenant",
          selfcareId,
        };
        const mockAuthData = getMockAuthData(mockTenant.id);
        await tenantService.selfcareUpsertTenant(tenantSeed, {
          authData: mockAuthData,
          correlationId,
          serviceName: "",
          logger: genericLogger,
        });

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
          protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(
            writtenEvent?.data
          );

        const updatedTenant: Tenant = {
          ...mockTenant,
          selfcareId,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("should create a tenant if it does not exist", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());
        const tenantSeed = {
          externalId: {
            origin: "IPA",
            value: generateId(),
          },
          name: "A tenant",
          selfcareId: generateId(),
        };
        const id = await tenantService.selfcareUpsertTenant(tenantSeed, {
          authData: getMockAuthData(),
          correlationId,
          serviceName: "",
          logger: genericLogger,
        });
        expect(id).toBeDefined();
        const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));
        if (!writtenEvent) {
          fail("Creation failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: id,
          version: "0",
          type: "TenantOnboarded",
        });
        const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
          TenantOnboardedV2
        ).parse(writtenEvent.data);

        const expectedTenant: Tenant = {
          externalId: tenantSeed.externalId,
          id: unsafeBrandId(id),
          kind: undefined,
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(),
          createdAt: new Date(),
          name: tenantSeed.name,
          attributes: [],
          features: [],
          mails: [],
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
        vi.useRealTimers();
      });
      it("should throw operation forbidden if role isn't internal and the requester is another tenant", async () => {
        const mockTenant = getMockTenant();
        await addOneTenant(mockTenant);

        const tenantSeed: tenantApi.SelfcareTenantSeed = {
          externalId: {
            origin: "IPA",
            value: mockTenant.externalId.value,
          },
          name: "A tenant",
          selfcareId: mockTenant.selfcareId!,
        };
        expect(
          tenantService.selfcareUpsertTenant(tenantSeed, {
            authData: getMockAuthData(),
            correlationId,
            serviceName: "",
            logger: genericLogger,
          })
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
        };
        const mockAuthData = getMockAuthData(mockTenant.id);
        expect(
          tenantService.selfcareUpsertTenant(newTenantSeed, {
            authData: mockAuthData,
            correlationId,
            serviceName: "",
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          selfcareIdConflict({
            tenantId: mockTenant.id,
            existingSelfcareId: mockTenant.selfcareId!,
            newSelfcareId: newTenantSeed.selfcareId,
          })
        );
      });
    });
    describe("updateTenantVerifiedAttribute", async () => {
      const correlationId = generateId();
      const expirationDate = new Date(
        currentDate.setDate(currentDate.getDate() + 1)
      );

      const updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed =
        {
          expirationDate: expirationDate.toISOString(),
        };

      const tenant: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            ...mockVerifiedTenantAttribute,
            verifiedBy: [
              {
                ...mockVerifiedBy,
                expirationDate,
              },
            ],
          },
        ],
        updatedAt: currentDate,
        name: "A tenant",
      };
      const attributeId = tenant.attributes.map((a) => a.id)[0];
      const verifierId = mockVerifiedBy.id;
      it("should update the expirationDate", async () => {
        await addOneTenant(tenant);
        await tenantService.updateTenantVerifiedAttribute(
          {
            verifierId,
            tenantId: tenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
          },
          {
            correlationId,
            logger: genericLogger,
            serviceName: "",
            authData: getMockAuthData(),
          }
        );
        const writtenEvent = await readLastTenantEvent(tenant.id);
        if (!writtenEvent) {
          fail("Creation fails: tenant not found in event-store");
        }
        expect(writtenEvent).toBeDefined();
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe(
          "TenantVerifiedAttributeExpirationUpdated"
        );
        const writtenPayload:
          | TenantVerifiedAttributeExpirationUpdatedV2
          | undefined = protobufDecoder(
          TenantVerifiedAttributeExpirationUpdatedV2
        ).parse(writtenEvent.data);

        if (!writtenPayload) {
          fail(
            "impossible to decode TenantVerifiedAttributeExpirationUpdatedV2 data"
          );
        }

        const updatedTenant: Tenant = {
          ...tenant,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("should throw tenantNotFound when tenant doesn't exist", async () => {
        expect(
          tenantService.updateTenantVerifiedAttribute(
            {
              verifierId,
              tenantId: tenant.id,
              attributeId,
              updateVerifiedTenantAttributeSeed,
            },
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });

      it("should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
        const expirationDateinPast = new Date(
          currentDate.setDate(currentDate.getDate() - 3)
        );

        const updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed =
          {
            expirationDate: expirationDateinPast.toISOString(),
          };

        await addOneTenant(tenant);
        expect(
          tenantService.updateTenantVerifiedAttribute(
            {
              verifierId,
              tenantId: tenant.id,
              attributeId,
              updateVerifiedTenantAttributeSeed,
            },
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          expirationDateCannotBeInThePast(expirationDateinPast)
        );
      });
      it("should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        const updatedCertifiedTenant: Tenant = {
          ...getMockTenant(),
          attributes: [{ ...mockCertifiedTenantAttribute }],
          updatedAt: currentDate,
          name: "A updatedCertifiedTenant",
        };
        const attributeId = updatedCertifiedTenant.attributes.map(
          (a) => a.id
        )[0];
        await addOneTenant(updatedCertifiedTenant);
        expect(
          tenantService.updateTenantVerifiedAttribute(
            {
              verifierId: generateId(),
              tenantId: updatedCertifiedTenant.id,
              attributeId,
              updateVerifiedTenantAttributeSeed,
            },
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          verifiedAttributeNotFoundInTenant(
            updatedCertifiedTenant.id,
            attributeId
          )
        );
      });
      it("should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
        await addOneTenant(tenant);
        const verifierId = generateId();
        expect(
          tenantService.updateTenantVerifiedAttribute(
            {
              verifierId,
              tenantId: tenant.id,
              attributeId,
              updateVerifiedTenantAttributeSeed,
            },
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
        );
      });
    });
    describe("updateVerifiedAttributeExtensionDate", async () => {
      const correlationId = generateId();
      const expirationDate = new Date(
        currentDate.setDate(currentDate.getDate() + 1)
      );

      const tenant: Tenant = {
        ...getMockTenant(),
        attributes: [
          {
            ...mockVerifiedTenantAttribute,
            verifiedBy: [
              {
                ...mockVerifiedBy,
                extensionDate: currentDate,
                expirationDate,
              },
            ],
          },
        ],
        name: "A Tenant",
      };
      const attributeId = tenant.attributes.map((a) => a.id)[0];
      const verifierId = mockVerifiedBy.id;
      it("should update the extensionDate", async () => {
        const extensionDate = new Date(
          currentDate.getTime() +
            (expirationDate.getTime() -
              mockVerifiedBy.verificationDate.getTime())
        );

        await addOneTenant(tenant);
        await tenantService.updateVerifiedAttributeExtensionDate(
          tenant.id,
          attributeId,
          verifierId,
          {
            correlationId,
            logger: genericLogger,
            serviceName: "",
            authData: getMockAuthData(),
          }
        );
        const writtenEvent = await readLastTenantEvent(tenant.id);
        if (!writtenEvent) {
          fail("Creation fails: tenant not found in event-store");
        }
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe(
          "TenantVerifiedAttributeExtensionUpdated"
        );
        const writtenPayload:
          | TenantVerifiedAttributeExtensionUpdatedV2
          | undefined = protobufDecoder(
          TenantVerifiedAttributeExtensionUpdatedV2
        ).parse(writtenEvent.data);

        const updatedTenant: Tenant = {
          ...tenant,
          attributes: [
            {
              ...mockVerifiedTenantAttribute,
              verifiedBy: [
                {
                  ...mockVerifiedBy,
                  extensionDate,
                  expirationDate,
                },
              ],
            },
          ],
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("should throw tenantNotFound when tenant doesn't exist", async () => {
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            tenant.id,
            attributeId,
            verifierId,
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });

      it("should throw expirationDateNotFoundInVerifier", async () => {
        const expirationDate = undefined;

        const updatedTenantWithoutExpirationDate: Tenant = {
          ...getMockTenant(),
          attributes: [
            {
              ...mockVerifiedTenantAttribute,
              verifiedBy: [
                {
                  ...mockVerifiedBy,
                  expirationDate,
                },
              ],
            },
          ],
          name: "A updatedTenant",
        };
        const attributeId = updatedTenantWithoutExpirationDate.attributes.map(
          (a) => a.id
        )[0];
        await addOneTenant(updatedTenantWithoutExpirationDate);
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            updatedTenantWithoutExpirationDate.id,
            attributeId,
            verifierId,
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          expirationDateNotFoundInVerifier(
            verifierId,
            attributeId,
            updatedTenantWithoutExpirationDate.id
          )
        );
      });
      it("should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        const mockTenant: Tenant = { ...getMockTenant(), attributes: [] };
        await addOneTenant(mockTenant);
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            mockTenant.id,
            attributeId,
            verifierId,
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
        );
      });
      it("should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
        await addOneTenant(tenant);
        const verifierId = generateId();
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            tenant.id,
            attributeId,
            verifierId,
            {
              correlationId,
              logger: genericLogger,
              serviceName: "",
              authData: getMockAuthData(),
            }
          )
        ).rejects.toThrowError(
          organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
        );
      });
    });
  });
  describe("readModelService", () => {
    const tenant1: Tenant = {
      ...getMockTenant(),
      name: "Tenant 1",
    };
    const tenant2: Tenant = {
      ...getMockTenant(),
      name: "Tenant 2",
    };
    const tenant3: Tenant = {
      ...getMockTenant(),
      name: "Tenant 3",
    };
    const tenant4: Tenant = {
      ...getMockTenant(),
      name: "Tenant 4",
    };
    const tenant5: Tenant = {
      ...getMockTenant(),
      name: "Tenant 5",
    };
    describe("getConsumers", () => {
      it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(3);
        expect(consumers.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get the tenants consuming any of the eservices of a specific name", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3);

        const consumers = await readModelService.getConsumers({
          consumerName: tenant1.name,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(1);
        expect(consumers.results).toEqual([tenant1]);
      });
      it("should not get any tenants, if no one is consuming any of the eservices of a specific producerId", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(0);
        expect(consumers.results).toEqual([]);
      });
      it("should not get any tenants, if no one is consuming any of the eservices of a specific name", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const consumers = await readModelService.getConsumers({
          consumerName: "Tenant 4",
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(0);
        expect(consumers.results).toEqual([]);
      });
      it("should get consumers (pagination: limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 2,
        });
        expect(tenantsByName.results.length).toBe(2);
      });
      it("should get consumers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 2,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(1);
      });
    });
    describe("getProducers", () => {
      it("should get producers", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3);

        const producers = await readModelService.getProducers({
          producerName: undefined,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(3);
        expect(producers.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get producers by name", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        const producers = await readModelService.getProducers({
          producerName: tenant1.name,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(1);
        expect(producers.results).toEqual([tenant1]);
      });
      it("should not get any tenants if no one matches the requested name", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        const producers = await readModelService.getProducers({
          producerName: "Tenant 6",
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(0);
        expect(producers.results).toEqual([]);
      });
      it("should not get any tenants if no one is in DB", async () => {
        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        const producers = await readModelService.getProducers({
          producerName: "A tenant",
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(0);
        expect(producers.results).toEqual([]);
      });
      it("should get producers (pagination: limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3);
        const tenantsByName = await readModelService.getProducers({
          producerName: undefined,
          offset: 0,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(3);
      });
      it("should get producers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...getMockEService(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3);
        const tenantsByName = await readModelService.getProducers({
          producerName: undefined,
          offset: 2,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(1);
      });
    });
    describe("getTenants", () => {
      it("should get all the tenants with no filter", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);

        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(3);
        expect(tenantsByName.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get tenants by name", async () => {
        await addOneTenant(tenant1);

        await addOneTenant(tenant2);

        const tenantsByName = await readModelService.getTenantsByName({
          name: "Tenant 1",
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(1);
        expect(tenantsByName.results).toEqual([tenant1]);
      });
      it("should not get tenants if there are not any tenants", async () => {
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(0);
        expect(tenantsByName.results).toEqual([]);
      });
      it("should not get tenants if the name does not match", async () => {
        await addOneTenant(tenant1);

        await addOneTenant(tenant2);

        const tenantsByName = await readModelService.getTenantsByName({
          name: "Tenant 6",
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(0);
        expect(tenantsByName.results).toEqual([]);
      });
      it("should get a maximun number of tenants based on a specified limit", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        await addOneTenant(tenant4);
        await addOneTenant(tenant5);
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 4,
        });
        expect(tenantsByName.results.length).toBe(4);
      });
      it("should get a maximun number of tenants based on a specified limit and offset", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        await addOneTenant(tenant4);
        await addOneTenant(tenant5);
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 2,
          limit: 4,
        });
        expect(tenantsByName.results.length).toBe(3);
      });
    });
    describe("getTenantById", () => {
      it("should get the tenant by ID", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        const returnedTenant = await tenantService.getTenantById(
          tenant1.id,
          genericLogger
        );
        expect(returnedTenant).toEqual(tenant1);
      });
      it("should throw tenantNotFound if the tenant isn't in DB", async () => {
        await addOneTenant(tenant2);
        expect(
          tenantService.getTenantById(tenant1.id, genericLogger)
        ).rejects.toThrowError(tenantNotFound(tenant1.id));
      });
    });
    describe("getTenantBySelfcareId", () => {
      it("should get the tenant by selfcareId", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        const returnedTenant = await tenantService.getTenantBySelfcareId(
          tenant1.selfcareId!,
          genericLogger
        );
        expect(returnedTenant).toEqual(tenant1);
      });
      it("should throw tenantNotFoundBySelfcareId if the tenant isn't in DB", async () => {
        await addOneTenant(tenant2);
        expect(
          tenantService.getTenantBySelfcareId(
            tenant1.selfcareId!,
            genericLogger
          )
        ).rejects.toThrowError(tenantNotFoundBySelfcareId(tenant1.selfcareId!));
      });
    });
    describe("getTenantByExternalId", () => {
      it("should get the tenant by externalId", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        const returnedTenant = await tenantService.getTenantByExternalId(
          {
            value: tenant1.externalId.value,
            origin: tenant1.externalId.origin,
          },
          genericLogger
        );
        expect(returnedTenant).toEqual(tenant1);
      });
      it("should throw tenantNotFoundByExternalId if it isn't in DB", async () => {
        await addOneTenant(tenant2);
        expect(
          tenantService.getTenantByExternalId(
            {
              value: tenant1.externalId.value,
              origin: tenant1.externalId.origin,
            },
            genericLogger
          )
        ).rejects.toThrowError(
          tenantNotFoundByExternalId(
            tenant1.externalId.origin,
            tenant1.externalId.value
          )
        );
      });
    });
  });
});
