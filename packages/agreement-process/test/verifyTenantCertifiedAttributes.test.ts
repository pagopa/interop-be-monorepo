import { describe, expect, it } from "vitest";
import {
  getMockAuthData,
  getMockCertifiedTenantAttribute,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import { genericLogger } from "pagopa-interop-commons";
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
  operationRestrictedToDelegate,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
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
  const mockDescriptor = getMockDescriptorPublished(
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

    it("should verify attributes", async () => {
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
        {
          authData: getMockAuthData(delegation.delegateId),
          serviceName: "agreement-process",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      expect(result).toEqual({ hasCertifiedAttributes: true });
    });
    it("should throw operationRestrictedToDelegate when organizationId is not the delegate", async () => {
      const organizationId = generateId<TenantId>();
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
          {
            authData: getMockAuthData(organizationId),
            serviceName: "agreement-process",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        operationRestrictedToDelegate({
          delegatorId: organizationId,
          delegateId: mockTenant.id,
        })
      );
    });
  });
  describe("Without delegationId", () => {
    it("should verify attributes", async () => {
      await addOneEService(mockEService);
      await addOneTenant(mockTenant);

      const result = await agreementService.verifyTenantCertifiedAttributes(
        {
          tenantId: mockTenant.id,
          descriptorId: mockDescriptor.id,
          eserviceId: mockEService.id,
        },
        {
          authData: getMockAuthData(mockTenant.id),
          serviceName: "agreement-process",
          correlationId: generateId(),
          logger: genericLogger,
        }
      );

      expect(result).toEqual({ hasCertifiedAttributes: true });
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
        {
          authData: getMockAuthData(tenant.id),
          serviceName: "agreement-process",
          correlationId: generateId(),
          logger: genericLogger,
        }
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
          {
            authData: getMockAuthData(tenantId),
            serviceName: "agreement-process",
            correlationId: generateId(),
            logger: genericLogger,
          }
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
          {
            authData: getMockAuthData(mockTenant.id),
            serviceName: "agreement-process",
            correlationId: generateId(),
            logger: genericLogger,
          }
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
          {
            authData: getMockAuthData(mockTenant.id),
            serviceName: "agreement-process",
            correlationId: generateId(),
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(descriptorNotFound(mockEService.id, descriptorId));
    });
  });
});
