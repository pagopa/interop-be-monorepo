/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { rulesVersionNotFoundError } from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysisForm,
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockContext,
  getMockEService,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  generateId,
  DraftPurposeUpdatedV2,
  toPurposeV2,
  PurposeId,
  unsafeBrandId,
  TenantId,
  EServiceId,
  RiskAnalysis,
  eserviceMode,
  delegationKind,
  delegationState,
  Agreement,
  DelegationId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  purposeNotFound,
  tenantIsNotTheConsumer,
  purposeNotInDraftState,
  eserviceNotFound,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantNotFound,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  duplicatedPurposeTitle,
  tenantIsNotTheDelegatedConsumer,
  purposeDelegationNotFound,
  invalidFreeOfChargeReason,
  purposeFromTemplateCannotBeModified,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  readLastPurposeEvent,
  purposeService,
  addOneDelegation,
  addOneTenant,
  addOneEService,
  addOneAgreement,
  sortUpdatePurposeReturn,
} from "../integrationUtils.js";
import {
  buildRiskAnalysisSeed,
  createUpdatedPurpose,
  createUpdatedReversePurpose,
} from "../mockUtils.js";

describe("updatePurpose and updateReversePurpose", () => {
  const tenantType = randomArrayItem(Object.values(tenantKind));
  let tenant: Tenant;
  let eServiceDeliver: EService;
  let eServiceReceive: EService;
  let purposeForReceive: Purpose;
  let purposeForDeliver: Purpose;
  let validRiskAnalysis: RiskAnalysis;
  let purposeUpdateContent: purposeApi.PurposeUpdateContent;
  let reversePurposeUpdateContent: purposeApi.ReversePurposeUpdateContent;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    tenant = {
      ...getMockTenant(),
      kind: tenantType,
    };

    eServiceDeliver = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      producerId: tenant.id,
    };

    eServiceReceive = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: tenant.id,
    };

    purposeForReceive = {
      ...getMockPurpose(),
      eserviceId: eServiceReceive.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
      riskAnalysisForm: {
        ...getMockValidRiskAnalysisForm(tenantType),
        id: generateId(),
      },
    };

    purposeForDeliver = {
      ...getMockPurpose(),
      eserviceId: eServiceDeliver.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
    };

    validRiskAnalysis = getMockValidRiskAnalysis(tenantType);

    purposeUpdateContent = {
      title: "test",
      dailyCalls: 10,
      description: "test",
      isFreeOfCharge: true,
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
      freeOfChargeReason: "test",
    };

    reversePurposeUpdateContent = {
      title: "test",
      dailyCalls: 10,
      description: "test",
      isFreeOfCharge: true,
      freeOfChargeReason: "test",
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (including title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const updatePurposeReturn = await purposeService.updatePurpose(
      purposeForDeliver.id,
      purposeUpdateContent,
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const writtenEvent = await readLastPurposeEvent(purposeForDeliver.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purposeForDeliver.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedPurpose(
        purposeForDeliver,
        purposeUpdateContent,
        tenantType,
        writtenPayload.purpose!.riskAnalysisForm!
      )
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (no title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: purposeForDeliver.title,
    };

    const updatePurposeReturn = await purposeService.updatePurpose(
      purposeForDeliver.id,
      updateContentWithoutTitle,
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const writtenEvent = await readLastPurposeEvent(purposeForDeliver.id);

    expect(writtenEvent).toMatchObject({
      stream_id: purposeForDeliver.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedPurpose(
        purposeForDeliver,
        updateContentWithoutTitle,
        tenantType,
        writtenPayload.purpose!.riskAnalysisForm!
      )
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE (including title change)", async () => {
    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    const updatePurposeReturn = await purposeService.updateReversePurpose(
      purposeForReceive.id,
      reversePurposeUpdateContent,
      getMockContext({ authData: getMockAuthData(tenant.id) })
    );

    const writtenEvent = await readLastPurposeEvent(purposeForReceive.id);
    expect(writtenEvent).toMatchObject({
      stream_id: purposeForReceive.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedReversePurpose(
        purposeForReceive,
        reversePurposeUpdateContent
      )
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode DELIVER", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
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
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: delegatePurpose.title,
    };

    const updatePurposeReturn = await purposeService.updatePurpose(
      delegatePurpose.id,
      updateContentWithoutTitle,
      getMockContext({ authData })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedPurpose(
        delegatePurpose,
        updateContentWithoutTitle,
        tenantType,
        writtenPayload.purpose!.riskAnalysisForm!
      )
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode RECEIVE", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
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
    await addSomeRandomDelegations(purposeForDeliver, addOneDelegation);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    const updatePurposeReturn = await purposeService.updateReversePurpose(
      delegatePurpose.id,
      reversePurposeUpdateContent,
      getMockContext({ authData })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedReversePurpose(delegatePurpose, reversePurposeUpdateContent)
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a updatable state and the e-service is in mode DELIVER", async () => {
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };
    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
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

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: delegatePurpose.title,
    };

    const updatePurposeReturn = await purposeService.updatePurpose(
      delegatePurpose.id,
      updateContentWithoutTitle,
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedPurpose(
        delegatePurpose,
        updateContentWithoutTitle,
        tenantType,
        writtenPayload.purpose!.riskAnalysisForm!
      )
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose is in a updatable state and the e-service is in mode RECEIVE", async () => {
    const producerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantType,
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
    };
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: consumer.id,
      eserviceId: eservice.id,
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producerDelegator.id,
      delegateId: producer.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumerDelegator.id,
      delegateId: consumer.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegator);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegator);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const updatePurposeReturn = await purposeService.updateReversePurpose(
      delegatePurpose.id,
      reversePurposeUpdateContent,
      getMockContext({ authData: getMockAuthData(consumer.id) })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "DraftPurposeUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeUpdatedV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = sortPurpose(
      createUpdatedReversePurpose(delegatePurpose, reversePurposeUpdateContent)
    );

    const sortedWrittenPayloadPurpose = sortPurpose(writtenPayload.purpose);
    expect(sortedWrittenPayloadPurpose).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(sortUpdatePurposeReturn(updatePurposeReturn)).toEqual({
      data: { purpose: expectedPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });
  it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const purposeId: PurposeId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(
        purposeId,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(purposeNotFound(purposeId));
  });
  it("Should throw tenantIsNotTheConsumer if the organization is not the consumer", async () => {
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: generateId(),
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const organizationId: TenantId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(
        mockPurpose.id,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(organizationId));
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) => state !== purposeVersionState.draft
    )
  )(
    "Should throw purposeNotInDraftState if the purpose is in state %s",
    async (state) => {
      const mockPurpose: Purpose = {
        ...purposeForDeliver,
        versions: [{ ...getMockPurposeVersion(state) }],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(eServiceDeliver);
      await addOneTenant(tenant);

      expect(
        purposeService.updatePurpose(
          mockPurpose.id,
          purposeUpdateContent,
          getMockContext({ authData: getMockAuthData(tenant.id) })
        )
      ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
    }
  );
  it("Should throw duplicatedPurposeTitle if the purpose title already exists", async () => {
    const purposeWithDuplicatedTitle: Purpose = {
      ...purposeForDeliver,
      id: unsafeBrandId<PurposeId>(generateId()),
      title: "duplicated",
      versions: [],
    };
    await addOnePurpose(purposeForDeliver);
    await addOnePurpose(purposeWithDuplicatedTitle);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        {
          ...purposeUpdateContent,
          title: purposeWithDuplicatedTitle.title,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      duplicatedPurposeTitle(purposeWithDuplicatedTitle.title)
    );
  });
  it("Should throw purposeFromTemplateCannotBeModified if the purpose was created from a purpose template", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const purposeFromTemplate: Purpose = {
      ...purposeForDeliver,
      purposeTemplateId,
    };
    await addOnePurpose(purposeFromTemplate);

    expect(
      purposeService.updatePurpose(
        purposeFromTemplate.id,
        {
          ...purposeUpdateContent,
          title: purposeFromTemplate.title,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      purposeFromTemplateCannotBeModified(
        purposeFromTemplate.id,
        purposeTemplateId
      )
    );
  });
  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const eserviceId: EServiceId = unsafeBrandId(generateId());
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      eserviceId,
    };

    await addOnePurpose(mockPurpose);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        mockPurpose.id,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting DELIVER", async () => {
    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        purposeForReceive.id,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceReceive.id, "Deliver")
    );
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting RECEIVE", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        purposeForDeliver.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceDeliver.id, "Receive")
    );
  });
  it("Should throw missingFreeOfChargeReason if isFreeOfCharge is true but freeOfChargeReason is missing", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        {
          ...purposeUpdateContent,
          isFreeOfCharge: true,
          freeOfChargeReason: "",
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it.each([{ freeOfChargeReason: "Some reason" }, { freeOfChargeReason: "" }])(
    "Should throw invalidFreeOfChargeReason if isFreeOfCharge is false and freeOfChargeReason is defined (seed #%#)",
    async ({ freeOfChargeReason }) => {
      await addOnePurpose(purposeForDeliver);
      await addOneEService(eServiceDeliver);
      await addOneTenant(tenant);

      const isFreeOfCharge = false;
      expect(
        purposeService.updatePurpose(
          purposeForDeliver.id,
          {
            ...purposeUpdateContent,
            isFreeOfCharge,
            freeOfChargeReason,
          },
          getMockContext({ authData: getMockAuthData(tenant.id) })
        )
      ).rejects.toThrowError(
        invalidFreeOfChargeReason(isFreeOfCharge, freeOfChargeReason)
      );
    }
  );
  it("Should throw tenantNotFound if the tenant does not exist", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));

    await addOnePurpose(purposeForReceive);
    await addOneEService(eServiceReceive);

    expect(
      purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw tenantKindNotFound if the tenant kind does not exist", async () => {
    const mockTenant = {
      ...tenant,
      kind: undefined,
    };

    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(mockTenant);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        purposeUpdateContent,
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
    await addOnePurpose(purposeForDeliver);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    const invalidRiskAnalysis: RiskAnalysis = {
      ...validRiskAnalysis,
      riskAnalysisForm: {
        ...validRiskAnalysis.riskAnalysisForm,
        version: "0",
      },
    };

    const mockPurposeUpdateContent: purposeApi.PurposeUpdateContent = {
      ...purposeUpdateContent,
      riskAnalysisForm: buildRiskAnalysisSeed(invalidRiskAnalysis),
    };

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        mockPurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(tenant.kind!, "0"),
      ])
    );
  });
  it("should throw tenantIsNotTheDelegatedConsumer when the requester is the Consumer and is updating a purpose created by the delegate in updatePurpose", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);
    expect(
      purposeService.updatePurpose(
        delegatePurpose.id,
        purposeUpdateContent,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(authData.organizationId, delegation.id)
    );
  });
  it("should throw tenantIsNotTheDelegatedConsumer when the requester is the Consumer and is updating a purpose created by the delegate in updateReversePurpose", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(authData.organizationId, delegation.id)
    );
  });
  it("should throw purposeDelegationNotFound when the requester is the Consumer, is updating a purpose created by a delegate in updatePurpose, but the delegation cannot be found", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(delegatePurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      purposeDelegationNotFound(
        delegatePurpose.id,
        delegatePurpose.delegationId!
      )
    );
  });
  it("should throw purposeDelegationNotFound when the requester is the Consumer, is updating a purpose created by a delegate in updateReversePurpose, but the delegation cannot be found", async () => {
    const authData = getMockAuthData();

    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(delegatePurpose);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      purposeDelegationNotFound(
        delegatePurpose.id,
        delegatePurpose.delegationId!
      )
    );
  });
  it("should throw tenantIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose in updatePurpose", async () => {
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw tenantIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose in updateReversePurpose", async () => {
    const delegatePurpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneDelegation(delegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        delegatePurpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw tenantIsNotTheDelegatedConsumer when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in updatePurpose", async () => {
    const purpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updatePurpose(
        purpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(
        delegation.delegateId,
        purpose.delegationId
      )
    );
  });
  it("should throw tenantIsNotTheDelegatedConsumer when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in updateReversePurpose", async () => {
    const purpose: Purpose = {
      ...purposeForReceive,
      consumerId: tenant.id,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);
    await addOneEService(eServiceDeliver);
    await addOneTenant(tenant);

    expect(
      purposeService.updateReversePurpose(
        purpose.id,
        reversePurposeUpdateContent,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(
        delegation.delegateId,
        purpose.delegationId
      )
    );
  });
});
