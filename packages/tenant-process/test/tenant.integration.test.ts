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
  TenantId,
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
import { tenantApi } from "pagopa-interop-api-clients";
import {
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  selfcareIdConflict,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  expirationDateNotFoundInVerifier,
} from "../src/model/domain/errors.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  currentDate,
  getMockAgreement,
  getMockAuthData,
  getMockCertifiedTenantAttribute,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
  readLastTenantEvent,
  readModelService,
  tenantService,
} from "./utils.js";

describe("Integration tests", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockTenant = getMockTenant();
  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe("tenantService", () => {
    describe("selfcareUpsertTenant", async () => {
      const correlationId = generateId();
      const tenantSeed = {
        externalId: {
          origin: "IPA",
          value: "123456",
        },
        name: "A tenant",
        selfcareId: generateId(),
      };

      it("Should update the tenant if it exists", async () => {
        await addOneTenant(mockTenant);
        const kind = tenantKind.PA;
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
          kind,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should create a tenant by the upsert if it does not exist", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());
        const mockAuthData = getMockAuthData();
        const tenantSeed = {
          externalId: {
            origin: "Nothing",
            value: "0",
          },
          name: "A tenant",
          selfcareId: generateId(),
        };
        const id = await tenantService.selfcareUpsertTenant(tenantSeed, {
          authData: mockAuthData,
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
          ...mockTenant,
          externalId: tenantSeed.externalId,
          id: unsafeBrandId(id),
          kind: getTenantKind([], tenantSeed.externalId),
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(),
          createdAt: new Date(),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
        vi.useRealTimers();
      });
      it("Should throw operation forbidden if role isn't internal", async () => {
        await addOneTenant(mockTenant);
        const mockAuthData = getMockAuthData(generateId<TenantId>());

        expect(
          tenantService.selfcareUpsertTenant(tenantSeed, {
            authData: mockAuthData,
            correlationId,
            serviceName: "",
            logger: genericLogger,
          })
        ).rejects.toThrowError(operationForbidden);
      });
      it("Should throw selfcareIdConflict error if the given and existing selfcareId differs", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          selfcareId: generateId(),
        };
        await addOneTenant(tenant);
        const newTenantSeed = {
          ...tenantSeed,
          selfcareId: generateId(),
        };
        const mockAuthData = getMockAuthData(tenant.id);
        expect(
          tenantService.selfcareUpsertTenant(newTenantSeed, {
            authData: mockAuthData,
            correlationId,
            serviceName: "",
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          selfcareIdConflict({
            tenantId: tenant.id,
            existingSelfcareId: tenant.selfcareId!,
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
        ...mockTenant,
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
      it("Should update the expirationDate", async () => {
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
      it("Should throw tenantNotFound when tenant doesn't exist", async () => {
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

      it("Should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
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
      it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        const updatedCertifiedTenant: Tenant = {
          ...mockTenant,
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
      it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
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
        ...mockTenant,
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
      it("Should update the extensionDate", async () => {
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
      it("Should throw tenantNotFound when tenant doesn't exist", async () => {
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

      it("Should throw expirationDateNotFoundInVerifier", async () => {
        const expirationDate = undefined;

        const updatedTenantWithoutExpirationDate: Tenant = {
          ...mockTenant,
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
      it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        await addOneTenant(mockTenant);
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
          verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
        );
      });
      it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
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
      ...mockTenant,
      id: generateId(),
      name: "A tenant1",
    };
    const tenant2: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant2",
    };
    const tenant3: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant3",
    };
    const tenant4: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant4",
    };
    const tenant5: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant5",
    };
    describe("getConsumers", () => {
      it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3);

        const consumers = await readModelService.getConsumers({
          consumerName: "A tenant4",
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(0);
        expect(consumers.results).toEqual([]);
      });
      it("Should get consumers (pagination: limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
      it("Should get consumers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        const producers = await readModelService.getProducers({
          producerName: "A tenant6",
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(0);
        expect(producers.results).toEqual([]);
      });
      it("should not get any tenants if no one is in DB", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
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
      it("Should get producers (pagination: limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
      it("Should get producers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1);

        await addOneTenant(tenant2);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2);

        await addOneTenant(tenant3);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
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
          name: "A tenant1",
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
          name: "A tenant6",
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(0);
        expect(tenantsByName.results).toEqual([]);
      });
      it("Should get a maximun number of tenants based on a specified limit", async () => {
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
      it("Should get a maximun number of tenants based on a specified limit and offset", async () => {
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
        const tenantById = await readModelService.getTenantById(tenant1.id);
        expect(tenantById?.data).toEqual(tenant1);
      });
      it("should not get the tenant by ID if it isn't in DB", async () => {
        const tenantById = await readModelService.getTenantById(tenant1.id);
        expect(tenantById?.data.id).toBeUndefined();
      });
    });
    describe("getTenantBySelfcareId", () => {
      it("should get the tenant by selfcareId", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tenant1.selfcareId!
        );
        expect(tenantBySelfcareId?.data).toEqual(tenant1);
      });
      it("should not get the tenant by selfcareId if it isn't in DB", async () => {
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tenant1.selfcareId!
        );
        expect(tenantBySelfcareId?.data.selfcareId).toBeUndefined();
      });
    });
    describe("getTenantByExternalId", () => {
      it("should get the tenant by externalId", async () => {
        await addOneTenant(tenant1);
        await addOneTenant(tenant2);
        await addOneTenant(tenant3);
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          {
            value: tenant1.externalId.value,
            origin: tenant1.externalId.origin,
          }
        );
        expect(tenantByExternalId?.data).toEqual(tenant1);
      });
      it("should not get the tenant by externalId if it isn't in DB", async () => {
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          {
            value: tenant1.externalId.value,
            origin: tenant1.externalId.origin,
          }
        );
        expect(tenantByExternalId?.data.externalId).toBeUndefined();
      });
    });
  });
});
