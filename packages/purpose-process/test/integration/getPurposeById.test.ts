/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockPurposeVersion,
  getMockAuthData,
  getMockContext,
  getMockEService,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  generateId,
  PurposeId,
  EServiceId,
  TenantId,
  EService,
  Delegation,
  delegationKind,
  delegationState,
  Agreement,
  PurposeVersion,
  agreementState,
  eserviceMode,
  purposeVersionState,
  DelegationId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  purposeService,
  addOneDelegation,
  addOneAgreement,
  addOneEService,
  addOneTenant,
} from "../integrationUtils.js";

describe("getPurposeById", () => {
  it("should get the purpose if the requester is the active e-service producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      purposeTemplateId: generateId<PurposeTemplateId>(),
    };
    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      id: generateId(),
      title: "another purpose",
    };
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await addOneEService(mockEService);
    await addOneTenant(producer);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(producer.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose if the requester is the consumer", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(consumer);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(consumer.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose with isRiskAnalysisValid false if risk analysis form is invalid", async () => {
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: consumer.id,
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(consumer);
    await addOneTenant(producer);

    const producerResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(producer.id) })
    );
    expect(producerResponse).toMatchObject({
      data: {
        purpose: mockPurpose1,
        isRiskAnalysisValid: false,
      },
      metadata: { version: 0 },
    });

    const consumerResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(consumer.id) })
    );
    expect(consumerResponse).toMatchObject({
      data: {
        purpose: mockPurpose1,
        isRiskAnalysisValid: false,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose if the requester is the e-service delegate producer", async () => {
    const producerDelegate = {
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
      delegateId: producerDelegate.id,
      state: delegationState.active,
    };

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(producerDelegate);
    await addOneDelegation(mockProducerDelegation);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(producerDelegate.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should throw tenantNotAllowed if the requester is not the producer, the consumer, or a delegate", async () => {
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
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    await expect(
      purposeService.getPurposeById(
        mockPurpose1.id,
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(tenantNotAllowed(mockTenant.id));
  });

  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw tenantNotAllowed if the requester has a producer delegation with state %s with the e-service purpose",
    async (delegationState) => {
      const producerDelegate = {
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
        delegateId: producerDelegate.id,
        state: delegationState,
      };

      await addOnePurpose(mockPurpose1);
      await addOneEService(mockEService);
      await addOneTenant(producerDelegate);
      await addOneDelegation(mockProducerDelegation);

      await expect(
        purposeService.getPurposeById(
          mockPurpose1.id,
          getMockContext({ authData: getMockAuthData(producerDelegate.id) })
        )
      ).rejects.toThrowError(tenantNotAllowed(producerDelegate.id));
    }
  );

  it("should get the purpose if the requester is the delegate consumer who created the purpose", async () => {
    const consumerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
    };

    const delegationId = generateId<DelegationId>();
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      delegationId,
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    };

    const mockConsumerDelegation: Delegation = getMockDelegation({
      id: delegationId,
      kind: delegationKind.delegatedConsumer,
      delegatorId: mockPurpose1.consumerId,
      eserviceId: mockEService.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneEService(mockEService);
    await addOneTenant(consumerDelegate);
    await addOneDelegation(mockConsumerDelegation);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose created by the delegate consumer if the requester is the e-service delegate producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const producerDelegate = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      state: delegationState.active,
    });

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(producer);
    await addOneTenant(producerDelegate);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(producerDelegate.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose created by the delegate consumer if the requester is the e-service producer", async () => {
    const producer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: producer.id,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(producer);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(producer.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose created by the delegate consumer if the requester is the consumer", async () => {
    const consumer = {
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
      consumerId: consumer.id,
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: mockPurpose1.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose1.eserviceId,
      delegatorId: mockPurpose1.consumerId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose1);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(mockPurpose1, addOneDelegation);
    await addOneEService(mockEService);
    await addOneTenant(consumer);

    const purposeResponse = await purposeService.getPurposeById(
      mockPurpose1.id,
      getMockContext({ authData: getMockAuthData(consumer.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(mockPurpose1),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should get the purpose created by the delegate consumer when requester is a consumer delegate and the eservice was created by a delegate producer", async () => {
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
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
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

    const purposeResponse = await purposeService.getPurposeById(
      delegatePurpose.id,
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );
    expect({
      ...purposeResponse,
      data: {
        ...purposeResponse.data,
        purpose: sortPurpose(purposeResponse.data.purpose),
      },
    } satisfies typeof purposeResponse).toMatchObject({
      data: {
        purpose: sortPurpose(delegatePurpose),
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });
  });

  it("should throw tenantNotAllowed if the requester is a delegate for the eservice when retrieving a purpose created by the consumer", async () => {
    const tenant = { ...getMockTenant(), kind: tenantKind.PA };
    const eservice = getMockEService();
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      delegationId: undefined,
    };

    const purposeDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: tenant.id,
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneDelegation(purposeDelegation);
    await addOneTenant(tenant);

    await expect(
      purposeService.getPurposeById(
        purpose.id,
        getMockContext({
          authData: getMockAuthData(purposeDelegation.delegateId),
        })
      )
    ).rejects.toThrowError(tenantNotAllowed(purposeDelegation.delegateId));
  });
  it("should throw tenantNotAllowed if there exists a purpose delegation but the requester is not the purpose delegate", async () => {
    const eservice = getMockEService();
    const delegate = { ...getMockTenant(), kind: tenantKind.PA };
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: delegate.id,
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneTenant(delegate);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);

    await expect(
      purposeService.getPurposeById(
        purpose.id,
        getMockContext({ authData: getMockAuthData(delegate.id) })
      )
    ).rejects.toThrowError(tenantNotAllowed(delegation.delegateId));
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const notExistingId: PurposeId = generateId();
    const mockTenant = getMockTenant();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);
    await addOneTenant(mockTenant);

    expect(
      purposeService.getPurposeById(
        notExistingId,
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(purposeNotFound(notExistingId));
  });
  it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const notExistingId: EServiceId = generateId();
    const consumer = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: notExistingId,
      consumerId: consumer.id,
    };
    await addOnePurpose(mockPurpose);
    await addOneTenant(consumer);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        getMockContext({ authData: getMockAuthData(consumer.id) })
      )
    ).rejects.toThrowError(eserviceNotFound(notExistingId));
  });
  it("should throw tenantNotFound if the tenant doesn't exist", async () => {
    const notExistingTenantId: TenantId = generateId();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        getMockContext({ authData: getMockAuthData(notExistingTenantId) })
      )
    ).rejects.toThrowError(tenantNotFound(notExistingTenantId));
  });
  it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(mockTenant);

    expect(
      purposeService.getPurposeById(
        mockPurpose.id,
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
});
