/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  expiredRulesVersionError,
  unexpectedFieldError,
  unexpectedFieldValueError,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidEServiceTemplateRiskAnalysis,
  randomArrayItem,
  getMockContext,
  getMockExpiredEServiceTemplateRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  eserviceMode,
  TenantKind,
  tenantKind,
  EServiceTemplateRiskAnalysisAddedV2,
  Tenant,
  unsafeBrandId,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it, vi, afterAll, beforeAll } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceTemplateNotFound,
  riskAnalysisValidationFailed,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
  eserviceTemplateRiskAnalysisNameDuplicate,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "../integrationUtils.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("createEServiceTemplateRiskAnalysis", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the creation of the eService template risk analysis", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

    const creationResponse = await eserviceTemplateService.createRiskAnalysis(
      eserviceTemplate.id,
      riskAnalysisSeed,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateRiskAnalysisAdded",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateRiskAnalysisAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      riskAnalysis: [
        {
          ...mockValidRiskAnalysis,
          id: unsafeBrandId(
            writtenPayload.eserviceTemplate!.riskAnalysis[0]!.id
          ),
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(
              writtenPayload.eserviceTemplate!.riskAnalysis[0]!
                .riskAnalysisForm!.id
            ),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eserviceTemplate!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
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
                    writtenPayload.eserviceTemplate!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
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
      eserviceTemplate: toEServiceTemplateV2(expectedEServiceTemplate),
      riskAnalysisId: expectedEServiceTemplate.riskAnalysis[0].id,
    });
    expect(creationResponse).toEqual({
      data: {
        eserviceTemplate: expectedEServiceTemplate,
        createdRiskAnalysisId: writtenPayload.riskAnalysisId,
      },
      metadata: { version: 1 },
    });
  });

  it("should throw eserviceTemplateNotFound if the eservice doesn't exist", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: generateId(),
    };
    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });
  it("should throw operationForbidden if the requester is not the creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: generateId(),
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const requesterId = generateId<TenantId>();
    await addOneTenant(getMockTenant(requesterId));

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
        ),
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceTemplateNotInDraftState if the eservice is not in draft state", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: generateId(),
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateNotInDraftState(eserviceTemplate.id)
    );
  });
  it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.deliver,
      versions: [eserviceTemplateVersion],
      creatorId: generateId(),
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(templateNotInReceiveMode(eserviceTemplate.id));
  });
  it("should throw eserviceTemplateRiskAnalysisNameDuplicate if risk analysis name is duplicated, case insensitive", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );

    const riskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: generateId(),
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const creator = {
      ...getMockTenant(eserviceTemplate.creatorId),
      kind: creatorTenantKind,
    };
    await addOneTenant(creator);

    const mockValidRiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
      {
        ...buildRiskAnalysisSeed(mockValidRiskAnalysis),
        name: riskAnalysis.name,
      };

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateRiskAnalysisNameDuplicate(riskAnalysis.name)
    );
  });
  it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

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

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        invalidRiskAnalysisSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
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
  it("should throw riskAnalysisValidationFailed if the risk analysis version has expired", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockExpiredRiskAnalysis =
      getMockExpiredEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockExpiredRiskAnalysis);

    expect(
      eserviceTemplateService.createRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        expiredRulesVersionError(
          riskAnalysisSeed.riskAnalysisForm.version,
          creatorTenantKind
        ),
      ])
    );
  });
});
