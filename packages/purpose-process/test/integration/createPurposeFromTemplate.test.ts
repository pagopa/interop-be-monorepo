/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeAddedV2,
  RiskAnalysisForm,
  Tenant,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  unsafeBrandId,
  TenantId,
  delegationKind,
  delegationState,
  PurposeTemplate,
  purposeTemplateState,
  EServiceDescriptorPurposeTemplate,
  RiskAnalysisFormTemplate,
  eserviceMode,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockTenant,
  getMockPurpose,
  getMockDescriptor,
  getMockAuthData,
  getMockDelegation,
  getMockContext,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { rulesVersionNotFoundError } from "pagopa-interop-commons";
import {
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisValidationFailed,
  agreementNotFound,
  duplicatedPurposeTitle,
  tenantIsNotTheConsumer,
  riskAnalysisVersionMismatch,
  eServiceModeNotAllowed,
  invalidPurposeTenantKind,
  purposeTemplateNotFound,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisAnswerNotInSuggestValues,
  invalidPersonalData,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";
import {
  buildRiskAnalysisFormSeed,
  getMockEServiceForPurposeFromTemplate,
  getMockPurposeFromTemplateSeed,
  getMockValidRiskAnalysisFormFromTemplate,
  toMockPurposeForPurposeV2,
} from "../mockUtils.js";

describe("createPurposeFromTemplate", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    version: "",
  };

  const eService1: EService = {
    ...getMockEServiceForPurposeFromTemplate(),
    producerId: tenant.id,
    descriptors: [descriptor1],
  };

  const agreementEservice1 = getMockAgreement(
    eService1.id,
    tenant.id,
    agreementState.active
  );

  const mockValidRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

  const mockValidRiskAnalysisForm = getMockValidRiskAnalysisFormFromTemplate(
    tenantKind.PA
  );

  const purposeFromTemplateSeed: purposeApi.PurposeFromTemplateSeed =
    getMockPurposeFromTemplateSeed(
      eService1.id,
      agreementEservice1.consumerId,
      buildRiskAnalysisFormSeed(mockValidRiskAnalysisForm)
    );

  const mockPurposeTemplate = getMockPurposeTemplate(
    unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId),
    purposeTemplateState.active
  );
  const mockPurposeTemplateWithValidRiskAnalysis: PurposeTemplate = {
    ...mockPurposeTemplate,
    purposeRiskAnalysisForm: mockValidRiskAnalysisFormTemplate,
  };

  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
      eserviceId: eService1.id,
      descriptorId: eService1.descriptors[0].id,
      createdAt: new Date(),
    };

  it("should write on event-store for the creation of a purpose", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    const createPurposeResponse =
      await purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisFormTemplate.singleAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
          key: answer.key,
          value:
            mockValidRiskAnalysisForm.singleAnswers.find(
              (a) => a.key === answer.key
            )?.value ?? answer.value,
        })
      ),
      multiAnswers: mockValidRiskAnalysisFormTemplate.multiAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[
            i
          ].id,
          key: answer.key,
          values:
            mockValidRiskAnalysisForm.multiAnswers.find(
              (a) => a.key === answer.key
            )?.values ?? answer.values,
        })
      ),
    };

    const expectedPurpose: Purpose = {
      title: purposeFromTemplateSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeFromTemplateSeed.eserviceId),
      consumerId: unsafeBrandId(purposeFromTemplateSeed.consumerId),
      description: mockPurposeTemplateWithValidRiskAnalysis.purposeDescription,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeFromTemplateSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge:
        mockPurposeTemplateWithValidRiskAnalysis.purposeIsFreeOfCharge,
      freeOfChargeReason:
        mockPurposeTemplateWithValidRiskAnalysis.purposeFreeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
      purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(toMockPurposeForPurposeV2(expectedPurpose)),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a purpose with template with isFreeOfCharge false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const mockPurposeTemplateNotFreeOfCharge: PurposeTemplate = {
      ...mockPurposeTemplateWithValidRiskAnalysis,
      id: generateId(),
      purposeIsFreeOfCharge: false,
    };

    const purposeTemplateEServiceDescriptorNotFreeOfCharge: EServiceDescriptorPurposeTemplate =
      {
        ...purposeTemplateEServiceDescriptor1,
        purposeTemplateId: mockPurposeTemplateNotFreeOfCharge.id,
      };

    await addOnePurposeTemplate(mockPurposeTemplateNotFreeOfCharge);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptorNotFreeOfCharge
    );

    const createPurposeResponse =
      await purposeService.createPurposeFromTemplate(
        mockPurposeTemplateNotFreeOfCharge.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisFormTemplate.singleAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
          key: answer.key,
          value:
            mockValidRiskAnalysisForm.singleAnswers.find(
              (a) => a.key === answer.key
            )?.value ?? answer.value,
        })
      ),
      multiAnswers: mockValidRiskAnalysisFormTemplate.multiAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[
            i
          ].id,
          key: answer.key,
          values:
            mockValidRiskAnalysisForm.multiAnswers.find(
              (a) => a.key === answer.key
            )?.values ?? answer.values,
        })
      ),
    };

    const expectedPurpose: Purpose = {
      title: purposeFromTemplateSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeFromTemplateSeed.eserviceId),
      consumerId: unsafeBrandId(purposeFromTemplateSeed.consumerId),
      description: mockPurposeTemplateNotFreeOfCharge.purposeDescription,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeFromTemplateSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: mockPurposeTemplateNotFreeOfCharge.purposeIsFreeOfCharge,
      freeOfChargeReason:
        mockPurposeTemplateNotFreeOfCharge.purposeFreeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
      purposeTemplateId: mockPurposeTemplateNotFreeOfCharge.id,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(toMockPurposeForPurposeV2(expectedPurpose)),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should succeed when requester is Consumer Delegate and the Purpose was created successfully", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const delegateTenant = { ...getMockTenant(), kind: tenantKind.PA };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eService1.id,
      delegatorId: unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId),
      delegateId: delegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(tenant);
    await addOneTenant(delegateTenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOneDelegation(delegation);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    const createPurposeResponse =
      await purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({ authData: getMockAuthData(delegateTenant.id) })
      );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisFormTemplate.singleAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
          key: answer.key,
          value:
            mockValidRiskAnalysisForm.singleAnswers.find(
              (a) => a.key === answer.key
            )?.value ?? answer.value,
        })
      ),
      multiAnswers: mockValidRiskAnalysisFormTemplate.multiAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[
            i
          ].id,
          key: answer.key,
          values:
            mockValidRiskAnalysisForm.multiAnswers.find(
              (a) => a.key === answer.key
            )?.values ?? answer.values,
        })
      ),
    };

    const expectedPurpose: Purpose = {
      title: purposeFromTemplateSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeFromTemplateSeed.eserviceId),
      consumerId: unsafeBrandId(purposeFromTemplateSeed.consumerId),
      delegationId: delegation.id,
      description: mockPurposeTemplateWithValidRiskAnalysis.purposeDescription,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeFromTemplateSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge:
        mockPurposeTemplateWithValidRiskAnalysis.purposeIsFreeOfCharge,
      freeOfChargeReason:
        mockPurposeTemplateWithValidRiskAnalysis.purposeFreeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
      purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(toMockPurposeForPurposeV2(expectedPurpose)),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose was created successfully", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

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

    const eservice: EService = {
      ...getMockEServiceForPurposeFromTemplate(),
      producerId: producerDelegate.id,
      descriptors: [descriptor1],
    };

    const purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate =
      {
        ...purposeTemplateEServiceDescriptor1,
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

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

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const delegatePurposeSeed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      eserviceId: eservice.id,
      consumerId: agreement.consumerId,
    };

    await addOneTenant(consumer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(producerDelegate);
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor
    );

    const createPurposeResponse =
      await purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        delegatePurposeSeed,
        getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
      );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisFormTemplate.singleAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
          key: answer.key,
          value:
            mockValidRiskAnalysisForm.singleAnswers.find(
              (a) => a.key === answer.key
            )?.value ?? answer.value,
        })
      ),
      multiAnswers: mockValidRiskAnalysisFormTemplate.multiAnswers.map(
        (answer, i) => ({
          id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[
            i
          ].id,
          key: answer.key,
          values:
            mockValidRiskAnalysisForm.multiAnswers.find(
              (a) => a.key === answer.key
            )?.values ?? answer.values,
        })
      ),
    };

    const expectedPurpose: Purpose = {
      title: delegatePurposeSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(delegatePurposeSeed.eserviceId),
      consumerId: unsafeBrandId(delegatePurposeSeed.consumerId),
      delegationId: consumerDelegation.id,
      description: mockPurposeTemplateWithValidRiskAnalysis.purposeDescription,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: delegatePurposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge:
        mockPurposeTemplateWithValidRiskAnalysis.purposeIsFreeOfCharge,
      freeOfChargeReason:
        mockPurposeTemplateWithValidRiskAnalysis.purposeFreeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
      purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(toMockPurposeForPurposeV2(expectedPurpose)),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });
  it("should throw purposeTemplateNotFound if the purpose template doesn't exists or is not active", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const nonExistingId = generateId<PurposeTemplateId>();
    expect(
      purposeService.createPurposeFromTemplate(
        nonExistingId,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(nonExistingId));

    const mockDraftPurposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplate,
      state: purposeTemplateState.draft,
    };
    await addOnePurposeTemplate(mockDraftPurposeTemplate);

    expect(
      purposeService.createPurposeFromTemplate(
        mockDraftPurposeTemplate.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(mockDraftPurposeTemplate.id)
    );
  });
  it("should throw tenantKindNotFound if the kind doesn't exists", async () => {
    const tenantWithoutKind: Tenant = {
      ...tenant,
      kind: undefined,
    };

    const eService: EService = {
      ...eService1,
      producerId: tenantWithoutKind.id,
    };

    const agreementEservice = getMockAgreement(
      eService.id,
      tenantWithoutKind.id
    );

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      eserviceId: eService.id,
      consumerId: agreementEservice.consumerId,
    };

    await addOneTenant(tenantWithoutKind);
    await addOneAgreement(agreementEservice);
    await addOneEService(eService);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantKindNotFound(tenantWithoutKind.id));
  });
  it("should throw tenantNotFound if the tenant doesn't exists", async () => {
    await addOneEService(eService1);

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("should throw agreementNotFound if the agreement doesn't exists ", async () => {
    const descriptor: Descriptor = {
      ...descriptor1,
      id: generateId(),
    };

    const eService: EService = {
      ...eService1,
      producerId: tenant.id,
      id: generateId(),
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...agreementEservice1,
      id: generateId(),
      eserviceId: eService.id,
      descriptorId: descriptor.id,
      producerId: eService.producerId,
      consumerId: tenant.id,
      state: agreementState.draft,
    };

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      eserviceId: eService.id,
      consumerId: agreement.consumerId,
    };

    await addOneTenant(tenant);
    await addOneAgreement(agreement);
    await addOneEService(eService);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(agreementNotFound(eService.id, tenant.id));
  });
  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(getMockEServiceForPurposeFromTemplate());
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      consumerId: generateId(),
    };

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(tenant.id));
  });
  it("should throw riskAnalysisValidationFailed if the purpose has a non valid risk analysis ", async () => {
    const mockPurposeTemplateWithInvalidRiskAnalysis: PurposeTemplate = {
      ...mockPurposeTemplateWithValidRiskAnalysis,
      purposeRiskAnalysisForm: {
        ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm,
        version: "0",
      } as RiskAnalysisFormTemplate,
    };

    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(mockPurposeTemplateWithInvalidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    const mockInvalidRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      version: "0",
    };

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: buildRiskAnalysisFormSeed(mockInvalidRiskAnalysisForm),
    };

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(
          tenant.kind!,
          mockInvalidRiskAnalysisForm.version
        ),
      ])
    );
  });
  it("should throw riskAnalysisVersionMismatch if the purpose has a risk analysis with a different version", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    const mockInvalidRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      version: "0",
    };

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: buildRiskAnalysisFormSeed(mockInvalidRiskAnalysisForm),
    };

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisVersionMismatch(
        mockInvalidRiskAnalysisForm.version,
        mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
          .version
      )
    );
  });
  it("should throw duplicatedPurposeTitle if a purpose with same name already exists", async () => {
    const existingPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: unsafeBrandId(purposeFromTemplateSeed.eserviceId),
      consumerId: unsafeBrandId(purposeFromTemplateSeed.consumerId),
      title: purposeFromTemplateSeed.title,
    };

    await addOnePurpose(existingPurpose);
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      duplicatedPurposeTitle(purposeFromTemplateSeed.title)
    );
  });
  it("should throw eServiceModeNotAllowed if chosen eservice is in receive mode", async () => {
    const eservice = {
      ...eService1,
      mode: eserviceMode.receive,
    };

    await addOneTenant(tenant);
    await addOneEService(eservice);

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eservice.id, eserviceMode.deliver)
    );
  });
  it("should throw invalidPurposeTenantKind if purpose tenant kind is different from purpose template target tenant kind", async () => {
    const privateTenant = {
      ...tenant,
      kind: tenantKind.PRIVATE,
    };

    const eService: EService = {
      ...eService1,
      producerId: privateTenant.id,
    };

    const agreementEservice = getMockAgreement(
      eService.id,
      privateTenant.id,
      agreementState.active
    );

    const seed = {
      ...purposeFromTemplateSeed,
      eserviceId: eService.id,
      consumerId: agreementEservice.consumerId,
    };

    await addOneTenant(privateTenant);
    await addOneAgreement(agreementEservice);
    await addOneEService(eService);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(privateTenant.id)),
        })
      )
    ).rejects.toThrowError(
      invalidPurposeTenantKind(
        privateTenant.kind,
        mockPurposeTemplateWithValidRiskAnalysis.targetTenantKind
      )
    );
  });
  it("should throw riskAnalysisMissingExpectedFieldError if purpose is missing an answer for an editable field", async () => {
    const validPurposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplateWithValidRiskAnalysis,
      purposeRiskAnalysisForm: {
        ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!,
        singleAnswers: [
          ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
            .singleAnswers,
          {
            key: "additionalFieldSingle",
            editable: false,
            id: generateId(),
            suggestedValues: ["suggestedValue1", "suggestedValue2"],
          },
        ],
        multiAnswers: [
          ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
            .multiAnswers,
          {
            key: "additionalFieldMulti",
            editable: true,
            id: generateId(),
            values: [],
          },
        ],
      },
    };

    const purposeTemplateDescriptor: EServiceDescriptorPurposeTemplate = {
      ...purposeTemplateEServiceDescriptor1,
      purposeTemplateId: validPurposeTemplate.id,
    };
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(validPurposeTemplate);
    await addOnePurposeTemplateEServiceDescriptor(purposeTemplateDescriptor);

    const purposeFromTemplateSeedSingle: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: {
        ...purposeFromTemplateSeed.riskAnalysisForm!,
        answers: {
          ...purposeFromTemplateSeed.riskAnalysisForm!.answers,
          additionalFieldMulti: ["value"],
        },
      },
    };

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeedSingle,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeedSingle.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisMissingExpectedFieldError("additionalFieldSingle")
    );

    const purposeFromTemplateSeedMulti: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: {
        ...purposeFromTemplateSeed.riskAnalysisForm!,
        answers: {
          ...purposeFromTemplateSeed.riskAnalysisForm!.answers,
          additionalFieldSingle: ["suggestedValue1"],
        },
      },
    };

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeedMulti,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeedMulti.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisMissingExpectedFieldError("additionalFieldMulti")
    );
  });
  it("should throw riskAnalysisContainsNotEditableAnswers if purpose contains an answer for a non editable field", async () => {
    const validPurposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplateWithValidRiskAnalysis,
      purposeRiskAnalysisForm: {
        ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!,
        singleAnswers: [
          ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
            .singleAnswers,
          {
            key: "additionalFieldSingle",
            editable: false,
            id: generateId(),
            suggestedValues: [],
          },
        ],
        multiAnswers: [
          ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
            .multiAnswers,
          {
            key: "additionalFieldMulti",
            editable: false,
            id: generateId(),
            values: [],
          },
        ],
      },
    };

    const purposeTemplateDescriptor: EServiceDescriptorPurposeTemplate = {
      ...purposeTemplateEServiceDescriptor1,
      purposeTemplateId: validPurposeTemplate.id,
    };
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(validPurposeTemplate);
    await addOnePurposeTemplateEServiceDescriptor(purposeTemplateDescriptor);

    const purposeFromTemplateSeedSingle: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: {
        ...purposeFromTemplateSeed.riskAnalysisForm!,
        answers: {
          ...purposeFromTemplateSeed.riskAnalysisForm!.answers,
          additionalFieldSingle: ["value"],
        },
      },
    };

    expect(
      purposeService.createPurposeFromTemplate(
        validPurposeTemplate.id,
        purposeFromTemplateSeedSingle,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisContainsNotEditableAnswers(
        validPurposeTemplate.id,
        "additionalFieldSingle"
      )
    );

    const purposeFromTemplateSeedMulti: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: {
        ...purposeFromTemplateSeed.riskAnalysisForm!,
        answers: {
          ...purposeFromTemplateSeed.riskAnalysisForm!.answers,
          additionalFieldMulti: ["value"],
        },
      },
    };

    expect(
      purposeService.createPurposeFromTemplate(
        validPurposeTemplate.id,
        purposeFromTemplateSeedMulti,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisContainsNotEditableAnswers(
        validPurposeTemplate.id,
        "additionalFieldMulti"
      )
    );
  });
  it("should throw riskAnalysisAnswerNotInSuggestValues if purpose contains an answer for an editable: false field with suggested values but the answer is not in the suggested values", async () => {
    const validPurposeTemplate: PurposeTemplate = {
      ...mockPurposeTemplateWithValidRiskAnalysis,
      purposeRiskAnalysisForm: {
        ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!,
        singleAnswers: [
          ...mockPurposeTemplateWithValidRiskAnalysis.purposeRiskAnalysisForm!
            .singleAnswers,
          {
            key: "additionalFieldSingle",
            editable: false,
            id: generateId(),
            suggestedValues: ["suggestedValue1", "suggestedValue2"],
          },
        ],
      },
    };

    const purposeTemplateDescriptor: EServiceDescriptorPurposeTemplate = {
      ...purposeTemplateEServiceDescriptor1,
      purposeTemplateId: validPurposeTemplate.id,
    };
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOnePurposeTemplate(validPurposeTemplate);
    await addOnePurposeTemplateEServiceDescriptor(purposeTemplateDescriptor);

    const seed: purposeApi.PurposeFromTemplateSeed = {
      ...purposeFromTemplateSeed,
      riskAnalysisForm: {
        ...purposeFromTemplateSeed.riskAnalysisForm!,
        answers: {
          ...purposeFromTemplateSeed.riskAnalysisForm!.answers,
          additionalFieldSingle: ["invalidValue"],
        },
      },
    };

    expect(
      purposeService.createPurposeFromTemplate(
        validPurposeTemplate.id,
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisAnswerNotInSuggestValues(
        validPurposeTemplate.id,
        "additionalFieldSingle"
      )
    );
  });
  it("should throw invalidPersonalData if eservice personalData: undefined", async () => {
    await addOneTenant(tenant);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);

    const eserviceNoPersonalData: EService = {
      ...eService1,
      personalData: undefined,
    };
    const purposeTemplateEServiceDescriptorNoPersonalData: EServiceDescriptorPurposeTemplate =
      {
        purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
        eserviceId: eserviceNoPersonalData.id,
        descriptorId: eserviceNoPersonalData.descriptors[0].id,
        createdAt: new Date(),
      };

    const agreementEserviceNoPersonalData = getMockAgreement(
      eserviceNoPersonalData.id,
      tenant.id,
      agreementState.active
    );

    await addOneEService(eserviceNoPersonalData);
    await addOneAgreement(agreementEserviceNoPersonalData);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptorNoPersonalData
    );

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(invalidPersonalData(undefined));
  });
  it("should throw invalidPersonalData if eservice personalData is different from purpose template handlesPersonalData", async () => {
    await addOneTenant(tenant);
    await addOnePurposeTemplate(mockPurposeTemplateWithValidRiskAnalysis);

    const eserviceOtherPersonalData: EService = {
      ...eService1,
      personalData:
        !mockPurposeTemplateWithValidRiskAnalysis.handlesPersonalData,
    };
    const purposeTemplateEServiceDescriptorOtherPersonalData: EServiceDescriptorPurposeTemplate =
      {
        purposeTemplateId: mockPurposeTemplateWithValidRiskAnalysis.id,
        eserviceId: eserviceOtherPersonalData.id,
        descriptorId: eserviceOtherPersonalData.descriptors[0].id,
        createdAt: new Date(),
      };

    const agreementEserviceOtherPersonalData = getMockAgreement(
      eserviceOtherPersonalData.id,
      tenant.id,
      agreementState.active
    );

    await addOneEService(eserviceOtherPersonalData);
    await addOneAgreement(agreementEserviceOtherPersonalData);
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptorOtherPersonalData
    );

    expect(
      purposeService.createPurposeFromTemplate(
        mockPurposeTemplateWithValidRiskAnalysis.id,
        purposeFromTemplateSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeFromTemplateSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(
      invalidPersonalData(eserviceOtherPersonalData.personalData)
    );
  });
});
