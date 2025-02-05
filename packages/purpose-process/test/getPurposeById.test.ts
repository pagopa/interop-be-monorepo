/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  writeInReadmodel,
  getMockValidRiskAnalysisForm,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  generateId,
  toReadModelEService,
  PurposeId,
  EServiceId,
  TenantId,
  toReadModelTenant,
  EService,
  Delegation,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  addOnePurpose,
  eservices,
  purposeService,
  tenants,
  delegations,
} from "./utils.js";

describe("getPurposeById", () => {
  it("should get the purpose if it exists", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = getMockEService();
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      id: generateId(),
      title: "another purpose",
    };
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: false,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is the active e-service producer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockTenant.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is the purpose agreement consumer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose with the risk analysis form if the requester is an e-service delegated producer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    const mockProducerDelegation: Delegation = {
      ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
      delegatorId: mockEService.producerId,
      eserviceId: mockEService.id,
      delegateId: mockTenant.id,
      state: delegationState.active,
    };

    await addOnePurpose(mockPurpose1);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
    await writeInReadmodel(mockProducerDelegation, delegations);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });
  it("should get the purpose without the risk analysis form if the requester is not the producer nor the consumer", async () => {
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      mockTenant.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: { ...mockPurpose1, riskAnalysisForm: undefined },
      isRiskAnalysisValid: false,
    });
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should get the purpose without the risk analysis form if the requester has a producer delegation with state %s with the e-service purpose",
    async (delegationState) => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };

      const mockEService: EService = {
        ...getMockEService(),
      };
      const mockPurpose1: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      };

      const mockProducerDelegation: Delegation = {
        ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
        delegatorId: mockEService.producerId,
        eserviceId: mockEService.id,
        delegateId: mockTenant.id,
        state: delegationState,
      };

      await addOnePurpose(mockPurpose1);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
      await writeInReadmodel(mockProducerDelegation, delegations);

      const result = await purposeService.getPurposeById(
        mockPurpose1.id,
        mockTenant.id,
        genericLogger
      );
      expect(result).toMatchObject({
        purpose: { ...mockPurpose1, riskAnalysisForm: undefined },
        isRiskAnalysisValid: false,
      });
    }
  );
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    const mockTenant = getMockTenant();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(notExistingId, mockTenant.id, genericLogger)
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const notExistingId: EServiceId = generateId();
    const mockTenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: notExistingId,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(eserviceNotFound(notExistingId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const notExistingId: TenantId = generateId();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        notExistingId,
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(notExistingId));
  });
  it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        mockTenant.id,
        genericLogger
      )
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
});
