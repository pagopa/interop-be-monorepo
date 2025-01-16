/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockPurposeVersion,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  writeInReadmodel,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  toPurposeV2,
  Tenant,
  Descriptor,
  EService,
  Agreement,
  agreementState,
  PurposeVersion,
  toReadModelEService,
  eserviceMode,
  toReadModelAgreement,
  NewPurposeVersionActivatedV2,
  NewPurposeVersionWaitingForApprovalV2,
  toReadModelTenant,
  delegationKind,
  delegationState,
  TenantId,
  tenantKind,
  DelegationId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  agreementNotFound,
  eserviceNotFound,
  missingRiskAnalysis,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  tenantKindNotFound,
  tenantNotFound,
  unchangedDailyCalls,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreements,
  eservices,
  postgresDB,
  purposeService,
  tenants,
} from "./utils.js";
import { addOnePurpose } from "./utils.js";

describe("createPurposeVersion", () => {
  let mockConsumer: Tenant;
  let mockProducer: Tenant;
  let mockEService: EService;
  let mockAgreement: Agreement;
  let mockPurpose: Purpose;
  let mockPurposeVersion: PurposeVersion;
  let mockEServiceDescriptor: Descriptor;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    mockConsumer = {
      ...getMockTenant(),
      kind: "PA",
    };

    mockProducer = {
      ...getMockTenant(),
      kind: "PA",
    };

    mockEServiceDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 25,
      dailyCallsTotal: 50,
    };

    mockEService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [mockEServiceDescriptor],
    };

    mockAgreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: mockConsumer.id,
      descriptorId: mockEService.descriptors[0].id,
      state: agreementState.active,
    };

    mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
      dailyCalls: 5,
    };

    mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockAgreement.consumerId,
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a new purpose version (daily calls increased and <= threshold)", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 24,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the creation of a new purpose version (daily calls decreased and <= threshold)", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 4,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 4,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the creation of a new purpose version in waiting for approval state (daily calls > threshold)", async () => {
    const descriptor: Descriptor = {
      ...mockEServiceDescriptor,
      dailyCallsPerConsumer: 25,
    };
    const eservice = { ...mockEService, descriptors: [descriptor] };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 30,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionWaitingForApproval",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      state: purposeVersionState.waitingForApproval,
      dailyCalls: 30,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [...mockPurpose.versions, expectedPurposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionWaitingForApprovalV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(returnedPurposeVersion.state).toEqual(
      purposeVersionState.waitingForApproval
    );
  });

  it("should succeed when requester is Consumer Delegate and the creation of a new purpose version is successful", async () => {
    const authData = getRandomAuthData();

    const delegatePurpose: Purpose = {
      ...mockPurpose,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion(
      delegatePurpose.id,
      {
        dailyCalls: 24,
      },
      {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastEventByStreamId(
      delegatePurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the creation of a new purpose version is successful", async () => {
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
      producerId: producer.id,
      descriptors: [mockEServiceDescriptor],
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: mockEServiceDescriptor.id,
      state: agreementState.active,
    };
    const delegatePurpose: Purpose = {
      ...mockPurpose,
      consumerId: consumer.id,
      eserviceId: eservice.id,
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

    const returnedPurposeVersion = await purposeService.createPurposeVersion(
      delegatePurpose.id,
      {
        dailyCalls: 24,
      },
      {
        authData: getRandomAuthData(consumerDelegate.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
    );

    const writtenEvent = await readLastEventByStreamId(
      delegatePurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should throw unchangedDailyCalls if the new request daily calls are the same of the previous version", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(
      async () =>
        await purposeService.createPurposeVersion(
          mockPurpose.id,
          {
            dailyCalls: mockPurposeVersion.dailyCalls,
          },
          {
            authData: getRandomAuthData(mockPurpose.consumerId),
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        )
    ).rejects.toThrowError(unchangedDailyCalls(mockPurpose.id));
  });

  it("should throw organizationIsNotTheConsumer if the caller is the producer", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 1000,
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(
      organizationIsNotTheConsumer(mockEService.producerId)
    );
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });

  it("should throw organizationIsNotTheConsumer if the caller is not the consumer", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);
    await writeInReadmodel(toReadModelTenant(anotherTenant), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(anotherTenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(organizationIsNotTheConsumer(anotherTenant.id));
  });

  it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(
      agreementNotFound(mockEService.id, mockConsumer.id)
    );
  });

  it.each([
    agreementState.archived,
    agreementState.draft,
    agreementState.missingCertifiedAttributes,
    agreementState.pending,
    agreementState.rejected,
    agreementState.suspended,
  ])(
    "should throw agreementNotFound if the caller has the agreement with state %s associated with the purpose",
    async (state) => {
      const agreement: Agreement = { ...mockAgreement, state };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelAgreement(agreement), agreements);
      await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
      await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

      expect(async () => {
        await purposeService.createPurposeVersion(
          mockPurpose.id,
          {
            dailyCalls: 20,
          },
          {
            authData: getRandomAuthData(mockPurpose.consumerId),
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        );
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(tenantNotFound(mockProducer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is DELIVER and the tenant consumer has no kind", async () => {
    const consumer: Tenant = { ...mockConsumer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is RECEIVE and the tenant producer has no kind", async () => {
    const producer: Tenant = { ...mockProducer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(producer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it("should throw missingRiskAnalysis if there is no risk-analysis version and the passed daily calls does not surpass the descriptor limits", async () => {
    const purpose: Purpose = {
      ...mockPurpose,
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
  });
  it("should throw organizationIsNotTheDelegatedConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const authData = getRandomAuthData();
    const purpose = {
      ...mockPurpose,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(
      organizationIsNotTheDelegatedConsumer(
        authData.organizationId,
        delegation.id
      )
    );
  });
  it("should throw organizationIsNotTheConsumer when the requester is the Consumer with no delegation", async () => {
    const authData = getRandomAuthData();
    const purpose = {
      ...mockPurpose,
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      );
    }).rejects.toThrowError(
      organizationIsNotTheConsumer(authData.organizationId)
    );
  });
});
