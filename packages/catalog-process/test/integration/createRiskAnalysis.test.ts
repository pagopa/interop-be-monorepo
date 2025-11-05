/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  unexpectedFieldValueError,
  unexpectedFieldError,
  expiredRulesVersionError,
} from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getMockDelegation,
  getMockContext,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockExpiredRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  TenantKind,
  tenantKind,
  Tenant,
  EService,
  eserviceMode,
  descriptorState,
  EServiceRiskAnalysisAddedV2,
  toEServiceV2,
  unsafeBrandId,
  operationForbidden,
  delegationState,
  generateId,
  delegationKind,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  tenantNotFound,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  riskAnalysisDuplicated,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("create risk analysis", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  it("should write on event-store for the creation of a risk analysis", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);
    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const creationResponse = await catalogService.createRiskAnalysis(
      eservice.id,
      riskAnalysisSeed,
      getMockContext({ authData: getMockAuthData(producer.id) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceRiskAnalysisAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice: EService = {
      ...eservice,
      riskAnalysis: [
        {
          ...mockValidRiskAnalysis,
          id: unsafeBrandId(writtenPayload.eservice!.riskAnalysis[0]!.id),
          createdAt: new Date(
            Number(writtenPayload.eservice!.riskAnalysis[0]!.createdAt)
          ),
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(
              writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.id
            ),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                      (sa) => sa.key === singleAnswer.key
                    )!.id
                  ),
                })
              ),
            multiAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                (multiAnswer) => ({
                  ...multiAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
                      (ma) => ma.key === multiAnswer.key
                    )!.id
                  ),
                })
              ),
          },
        },
      ],
    };

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      riskAnalysisId: expectedEservice.riskAnalysis[0].id,
    });
    expect(creationResponse).toEqual({
      data: {
        eservice: expectedEservice,
        createdRiskAnalysisId: writtenPayload.riskAnalysisId,
      },
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the creation of a risk analysis (delegate)", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);
    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const creationResponse = await catalogService.createRiskAnalysis(
      eservice.id,
      riskAnalysisSeed,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceRiskAnalysisAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice: EService = {
      ...eservice,
      riskAnalysis: [
        {
          ...mockValidRiskAnalysis,
          id: unsafeBrandId(writtenPayload.eservice!.riskAnalysis[0]!.id),
          createdAt: new Date(
            Number(writtenPayload.eservice!.riskAnalysis[0]!.createdAt)
          ),
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(
              writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.id
            ),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                      (sa) => sa.key === singleAnswer.key
                    )!.id
                  ),
                })
              ),
            multiAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                (multiAnswer) => ({
                  ...multiAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
                      (ma) => ma.key === multiAnswer.key
                    )!.id
                  ),
                })
              ),
          },
        },
      ],
    };

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      riskAnalysisId: expectedEservice.riskAnalysis[0].id,
    });
    expect(creationResponse).toEqual({
      data: {
        eservice: expectedEservice,
        createdRiskAnalysisId: writtenPayload.riskAnalysisId,
      },
      metadata: { version: 1 },
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.createRiskAnalysis(
        mockEService.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);
    expect(
      catalogService.createRiskAnalysis(
        mockEService.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);
    expect(
      catalogService.createRiskAnalysis(
        mockEService.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceNotInDraftState if the eservice is not in draft state", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.published,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });
  it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInReceiveMode(eservice.id));
  });
  it("should throw tenantNotFound if the producer tenant doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(tenantNotFound(eservice.producerId));
  });
  it("should throw tenantKindNotFound if the producer tenant kind doesn't exist", async () => {
    const producer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });
  it("should throw riskAnalysisDuplicated if risk analysis name is duplicated, case insensitive", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    await addOneTenant(producer);

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
      riskAnalysis: [
        {
          ...riskAnalysis,
          name: riskAnalysis.name.toUpperCase(),
        },
      ],
    };
    await addOneEService(eservice);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...buildRiskAnalysisSeed(riskAnalysis),
      name: riskAnalysis.name.toLowerCase(),
    };

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        riskAnalysisSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(
      riskAnalysisDuplicated(riskAnalysis.name.toLowerCase(), eservice.id)
    );
  });
  it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...buildRiskAnalysisSeed(mockValidRiskAnalysis),
    };

    const invalidRiskAnalysisSeed = {
      ...riskAnalysisSeed,
      riskAnalysisForm: {
        ...riskAnalysisSeed.riskAnalysisForm,
        answers: {
          purpose: ["invalid purpose"], // "purpose" is field expected for all tenant kinds
          unexpectedField: ["updated other purpose"],
          /*
          This risk analysis form has an unexpected field and an invalid value for the purpose field.
          The validation on create is schemaOnly: it does not check missing required fields or dependencies.
          However, it checks for unexpected fields and invalid values.
          So, the validation should fail with just two errors corresponding to the two invalid fields.
         */
        },
      },
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        invalidRiskAnalysisSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        unexpectedFieldValueError(
          "purpose",
          new Set(["INSTITUTIONAL", "OTHER"])
        ),
        unexpectedFieldError("unexpectedField"),
      ])
    );
  });
  it("should throw riskAnalysisValidationFailed if the risk analysis rules version has expired", async () => {
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const mockValidRiskAnalysis =
      getMockExpiredRiskAnalysis(producerTenantKind);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...buildRiskAnalysisSeed(mockValidRiskAnalysis),
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        riskAnalysisSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        expiredRulesVersionError(
          riskAnalysisSeed.riskAnalysisForm.version,
          producerTenantKind
        ),
      ])
    );
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed = {
      ...buildRiskAnalysisSeed(mockValidRiskAnalysis),
    };

    const eservice: EService = {
      ...mockEService,
      templateId,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [
        {
          ...mockDescriptor,
          state: descriptorState.draft,
        },
      ],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.createRiskAnalysis(
        eservice.id,
        riskAnalysisSeed,
        getMockContext({ authData: getMockAuthData(producer.id) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
