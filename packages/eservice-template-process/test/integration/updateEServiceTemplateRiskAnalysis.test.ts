/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  unexpectedFieldError,
  unexpectedFieldValueError,
} from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidEServiceTemplateRiskAnalysis,
  randomArrayItem,
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
  Tenant,
  unsafeBrandId,
  EServiceTemplateRiskAnalysisUpdatedV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it, vi, afterAll, beforeAll } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceTemplateNotFound,
  riskAnalysisValidationFailed,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
  riskAnalysisNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "../integrationUtils.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";

describe("updateEServiceTemplateRiskAnalysis", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the update of the eService template risk analysis", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
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
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis = {
      ...getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind),
      id: riskAnalysisToUpdate.id,
      name: "updated name",
    };
    const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

    await eserviceTemplateService.updateRiskAnalysis(
      eserviceTemplate.id,
      riskAnalysisToUpdate.id,
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
      type: "EServiceTemplateRiskAnalysisUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateRiskAnalysisUpdatedV2,
      payload: writtenEvent.data,
    });

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      riskAnalysis: [
        {
          ...riskAnalysisToUpdate,
          name: riskAnalysisSeed.name,
          riskAnalysisForm: {
            ...riskAnalysisToUpdate.riskAnalysisForm,
            singleAnswers:
              riskAnalysisToUpdate.riskAnalysisForm.singleAnswers.map(
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
              riskAnalysisToUpdate.riskAnalysisForm.multiAnswers.map(
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
        riskAnalysisSecondary,
      ],
    };

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
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
      creatorId: generateId(),
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
    };
    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });
  it("should throw riskAnalysisNotFound if the risk analysis doesn't exist", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
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
      creatorId: generateId(),
      riskAnalysis: [riskAnalysisSecondary],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisNotFound(eserviceTemplate.id, riskAnalysisToUpdate.id)
    );
  });
  it("should throw operationForbidden if the requester is not the creator", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
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
      creatorId: generateId(),
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const requesterId = generateId<TenantId>();
    await addOneTenant(getMockTenant(requesterId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind)
        ),
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceTemplateNotInDraftState if the eservice is not in draft state", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind)
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
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        buildRiskAnalysisSeed(
          getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind)
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(templateNotInReceiveMode(eserviceTemplate.id));
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

    const riskAnalysisToUpdate =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisSecondary =
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
      riskAnalysis: [riskAnalysisToUpdate, riskAnalysisSecondary],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis = {
      ...getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind),
      id: riskAnalysisToUpdate.id,
      name: "updated name",
    };
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
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysisToUpdate.id,
        invalidRiskAnalysisSeed,
        getMockContext({
          authData: getMockAuthData(creator.id),
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
});
