/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  genericLogger,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysisForm,
  getMockValidRiskAnalysis,
  writeInReadmodel,
  decodeProtobufPayload,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
} from "pagopa-interop-commons-test/index.js";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  generateId,
  toReadModelEService,
  DraftPurposeUpdatedV2,
  toPurposeV2,
  PurposeId,
  unsafeBrandId,
  TenantId,
  EServiceId,
  RiskAnalysis,
  eserviceMode,
  toReadModelTenant,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeNotInDraftState,
  eserviceNotFound,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantNotFound,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  duplicatedPurposeTitle,
  organizationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  getMockEService,
  buildRiskAnalysisSeed,
  addOnePurpose,
  createUpdatedPurpose,
  readLastPurposeEvent,
  eservices,
  purposeService,
  tenants,
  addOneDelegation,
} from "./utils.js";

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
      isFreeOfCharge: false,
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
    };

    reversePurposeUpdateContent = {
      ...purposeUpdateContent,
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (including title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      purposeForDeliver.id,
      purposeUpdateContent,
      {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForDeliver,
      purposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should write on event store for the update of a purpose of an e-service in mode DELIVER (no title change)", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: purposeForDeliver.title,
    };

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      purposeForDeliver.id,
      updateContentWithoutTitle,
      {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForDeliver,
      updateContentWithoutTitle,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE (including title change)", async () => {
    await addOnePurpose(purposeForReceive);
    await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
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

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForReceive,
      reversePurposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode DELIVER", async () => {
    const authData = getRandomAuthData();

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purposeForDeliver.eserviceId,
      delegatorId: purposeForDeliver.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(purposeForDeliver);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purposeForDeliver, addOneDelegation);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const updateContentWithoutTitle = {
      ...purposeUpdateContent,
      title: purposeForDeliver.title,
    };

    const { purpose, isRiskAnalysisValid } = await purposeService.updatePurpose(
      purposeForDeliver.id,
      updateContentWithoutTitle,
      {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForDeliver,
      updateContentWithoutTitle,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a updatable state and the e-service is in mode RECEIVE", async () => {
    const authData = getRandomAuthData();

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purposeForReceive.eserviceId,
      delegatorId: purposeForReceive.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(purposeForReceive);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purposeForDeliver, addOneDelegation);
    await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const { purpose, isRiskAnalysisValid } =
      await purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
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

    const expectedPurpose: Purpose = createUpdatedPurpose(
      purposeForReceive,
      reversePurposeUpdateContent,
      validRiskAnalysis,
      writtenPayload.purpose!.riskAnalysisForm!
    );

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(true);
  });
  it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const purposeId: PurposeId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(purposeId, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(purposeNotFound(purposeId));
  });
  it("Should throw organizationIsNotTheConsumer if the organization is not the consumer", async () => {
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      consumerId: generateId(),
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    const organizationId: TenantId = unsafeBrandId(generateId());

    expect(
      purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
        authData: getRandomAuthData(organizationId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationIsNotTheConsumer(organizationId));
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
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(toReadModelTenant(tenant), tenants);

      expect(
        purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        })
      ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
    }
  );
  it("Should throw duplicatedPurposeTitle if the purpose title already exists", async () => {
    const purposeWithDuplicatedTitle = {
      ...purposeForDeliver,
      id: unsafeBrandId<PurposeId>(generateId()),
      title: "duplicated",
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
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      duplicatedPurposeTitle(purposeWithDuplicatedTitle.title)
    );
  });
  it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
    const eserviceId: EServiceId = unsafeBrandId(generateId());
    const mockPurpose: Purpose = {
      ...purposeForDeliver,
      eserviceId,
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updatePurpose(mockPurpose.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(eserviceNotFound(eserviceId));
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting DELIVER", async () => {
    await addOnePurpose(purposeForReceive);
    await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updatePurpose(purposeForReceive.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceReceive.id, "Deliver")
    );
  });
  it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting RECEIVE", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updateReversePurpose(
        purposeForDeliver.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      eServiceModeNotAllowed(eServiceDeliver.id, "Receive")
    );
  });
  it("Should throw missingFreeOfChargeReason if isFreeOfCharge is true but freeOfChargeReason is missing", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updatePurpose(
        purposeForDeliver.id,
        {
          ...purposeUpdateContent,
          isFreeOfCharge: true,
        },
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it("Should throw tenantNotFound if the tenant does not exist", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);

    expect(
      purposeService.updatePurpose(purposeForDeliver.id, purposeUpdateContent, {
        authData: getRandomAuthData(tenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantNotFound(tenant.id));

    await addOnePurpose(purposeForReceive);
    await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);

    expect(
      purposeService.updateReversePurpose(
        purposeForReceive.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw tenantKindNotFound if the tenant kind does not exist", async () => {
    const mockTenant = {
      ...tenant,
      kind: undefined,
    };

    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);

    expect(
      purposeService.updatePurpose(purposeForDeliver.id, purposeUpdateContent, {
        authData: getRandomAuthData(mockTenant.id),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
  });
  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
    await addOnePurpose(purposeForDeliver);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

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
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
    );
  });
  it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updateReversePurpose", async () => {
    const purposeWithInvalidRiskAnalysis: Purpose = {
      ...purposeForReceive,
      riskAnalysisForm: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...purposeForReceive.riskAnalysisForm!,
        version: "0",
      },
    };

    await addOnePurpose(purposeWithInvalidRiskAnalysis);
    await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updateReversePurpose(
        purposeWithInvalidRiskAnalysis.id,
        reversePurposeUpdateContent,
        {
          authData: getRandomAuthData(tenant.id),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
    );
  });
  it("should throw organizationNotAllowed when the requester is the Consumer but there is a Consumer Delegation in updatePurpose", async () => {
    const authData = getRandomAuthData();
    const purpose = {
      ...purposeForDeliver,
      consumerId: authData.organizationId,
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);
    expect(
      purposeService.updatePurpose(purposeForDeliver.id, purposeUpdateContent, {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });
  it("should throw organizationNotAllowed when the requester is the Consumer but there is a Consumer Delegation in updateReversePurpose", async () => {
    const authData = getRandomAuthData();
    const purpose = {
      ...purposeForDeliver,
      consumerId: authData.organizationId,
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
    await writeInReadmodel(toReadModelTenant(tenant), tenants);

    expect(
      purposeService.updateReversePurpose(
        purposeForDeliver.id,
        reversePurposeUpdateContent,
        {
          authData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });
});
