/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  writeInReadmodel,
  getMockValidRiskAnalysisForm,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockPurposeVersion,
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
  Agreement,
  PurposeVersion,
  agreementState,
  eserviceMode,
  purposeVersionState,
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
  addOneDelegation,
  addOneAgreement,
  addOneEService,
  addOneTenant,
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

  it("should get the purpose with the risk analysis form if the requester is an e-service delegated consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
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

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelTenant(consumerDelegate), tenants);

    const result = await purposeService.getPurposeById(
      mockPurpose1.id,
      consumerDelegate.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: mockPurpose1,
      isRiskAnalysisValid: true,
    });
  });

  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and you should get the purpose with the risk analysis form", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion],
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const result = await purposeService.getPurposeById(
      delegatePurpose.id,
      consumerDelegate.id,
      genericLogger
    );
    expect(result).toMatchObject({
      purpose: delegatePurpose,
      isRiskAnalysisValid: true,
    });
  });

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
  // it.only("should throw organizationNotAllowed when the requester is the Consumer but there is a Consumer Delegation", async () => {
  //   const tenant = { ...getMockTenant(), kind: tenantKind.PA };

  //   console.log(tenant.id);
  //   const mockEService: EService = {
  //     ...getMockEService(),
  //   };
  //   const mockPurpose: Purpose = {
  //     ...getMockPurpose(),
  //     consumerId: tenant.id,
  //     eserviceId: mockEService.id,
  //     riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
  //   };

  //   const delegation = getMockDelegation({
  //     kind: delegationKind.delegatedConsumer,
  //     eserviceId: mockPurpose.eserviceId,
  //     delegatorId: mockPurpose.consumerId,
  //     delegateId: generateId<TenantId>(),
  //     state: delegationState.active,
  //   });

  //   await addOneTenant(tenant);
  //   await addOnePurpose(mockPurpose);
  //   await addOneDelegation(delegation);
  //   await addSomeRandomDelegations(mockPurpose, addOneDelegation);
  //   await writeInReadmodel(toReadModelEService(mockEService), eservices);

  //   expect(
  //     purposeService.getPurposeById(mockPurpose.id, tenant.id, genericLogger)
  //   ).rejects.toThrowError(organizationNotAllowed(tenant.id));
  // });
});
