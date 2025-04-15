import { describe, expect, it } from "vitest";
import {
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockDelegation,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  CertifiedTenantAttribute,
  delegationState,
  DescriptorId,
  EServiceId,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  descriptorNotFound,
  eServiceNotFound,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  getAMockDescriptorPublished,
} from "./utils.js";

describe("Verify Tenant Certified Attributes", () => {
  const attribute1: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    revocationTimestamp: undefined,
  };
  const attribute2: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    revocationTimestamp: undefined,
  };
  const attribute3: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    revocationTimestamp: undefined,
  };

  const mockTenant = getMockTenant(undefined, [
    attribute1,
    attribute2,
    attribute3,
  ]);
  const mockDescriptor = getAMockDescriptorPublished(
    generateId<DescriptorId>(),
    [
      [
        getMockEServiceAttribute(attribute1.id),
        getMockEServiceAttribute(attribute2.id),
        getMockEServiceAttribute(attribute3.id),
      ],
    ]
  );

  const mockEService = getMockEService(
    generateId<EServiceId>(),
    generateId<TenantId>(),
    [mockDescriptor]
  );
  describe("With delegationId", () => {
    const mockDelegation = getMockDelegation({
      kind: "DelegatedConsumer",
      eserviceId: mockEService.id,
      delegatorId: mockTenant.id,
    });

    it("should verify attributes when orgnizationId is the delegate", async () => {
      const delegation = {
        ...mockDelegation,
        state: delegationState.active,
        delegatorId: mockTenant.id,
      };

      await addOneEService(mockEService);
      await addOneTenant(mockTenant);
      await addOneDelegation(delegation);

      const result = await agreementService.verifyTenantCertifiedAttributes(
        {
          tenantId: mockTenant.id,
          descriptorId: mockDescriptor.id,
          eserviceId: mockEService.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );

      expect(result).toEqual({ hasCertifiedAttributes: true });
    });
    it("should throw organizationIsNotTheDelegateConsumer when organizationId is not the delegate", async () => {
      const authData = getMockAuthData();
      const delegation = {
        ...mockDelegation,
        state: delegationState.active,
        delegatorId: mockTenant.id,
      };

      await addOneDelegation(delegation);

      await expect(
        agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId: mockTenant.id,
            descriptorId: mockDescriptor.id,
            eserviceId: mockEService.id,
          },
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        organizationIsNotTheDelegateConsumer(
          authData.organizationId,
          delegation.id
        )
      );
    });
  });
  describe("Without delegationId", () => {
    it("should verify attributes when organizationId is the tenant", async () => {
      await addOneEService(mockEService);
      await addOneTenant(mockTenant);

      const result = await agreementService.verifyTenantCertifiedAttributes(
        {
          tenantId: mockTenant.id,
          descriptorId: mockDescriptor.id,
          eserviceId: mockEService.id,
        },
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      );

      expect(result).toEqual({ hasCertifiedAttributes: true });
    });
    it("should throw organizationIsNotTheConsumer when organizationId !== tenantId", async () => {
      const authData = getMockAuthData();

      await expect(
        agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId: mockTenant.id,
            descriptorId: mockDescriptor.id,
            eserviceId: mockEService.id,
          },
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        organizationIsNotTheConsumer(authData.organizationId)
      );
    });
    it("should return true if the consumer is the producer even if the tenant has invalid certified attributes", async () => {
      const tenant: Tenant = {
        ...mockTenant,
        attributes: [],
      };

      await addOneEService({ ...mockEService, producerId: tenant.id });
      await addOneTenant(tenant);

      const result = await agreementService.verifyTenantCertifiedAttributes(
        {
          tenantId: tenant.id,
          descriptorId: mockDescriptor.id,
          eserviceId: mockEService.id,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      );

      expect(result).toEqual({ hasCertifiedAttributes: true });
    });
    it("should throw tenantNotFound if tenant is not found", async () => {
      const tenantId = generateId<TenantId>();

      await expect(
        agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId,
            descriptorId: mockDescriptor.id,
            eserviceId: mockEService.id,
          },
          getMockContext({ authData: getMockAuthData(tenantId) })
        )
      ).rejects.toThrowError(tenantNotFound(tenantId));
    });
    it("should throw eServiceNotFound if eservice is not found", async () => {
      const eserviceId = generateId<EServiceId>();

      await addOneTenant(mockTenant);

      await expect(
        agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId: mockTenant.id,
            descriptorId: mockDescriptor.id,
            eserviceId,
          },
          getMockContext({ authData: getMockAuthData(mockTenant.id) })
        )
      ).rejects.toThrowError(eServiceNotFound(eserviceId));
    });
    it("should throw descriptorNotFound if descriptor is not found", async () => {
      const descriptorId = generateId<DescriptorId>();

      await addOneEService(mockEService);
      await addOneTenant(mockTenant);

      await expect(
        agreementService.verifyTenantCertifiedAttributes(
          {
            tenantId: mockTenant.id,
            descriptorId,
            eserviceId: mockEService.id,
          },
          getMockContext({ authData: getMockAuthData(mockTenant.id) })
        )
      ).rejects.toThrowError(descriptorNotFound(mockEService.id, descriptorId));
    });
  });
});
