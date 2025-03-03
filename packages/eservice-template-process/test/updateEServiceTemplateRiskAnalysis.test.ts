/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  genericLogger,
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
  getMockValidRiskAnalysis,
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
  eServiceTemplateNotFound,
  riskAnalysisValidationFailed,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  buildRiskAnalysisSeed,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "./utils.js";

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

    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis = {
      ...getMockValidRiskAnalysis(creatorTenantKind),
      id: riskAnalysis1.id,
      name: "updated name",
    };
    const riskAnalysisSeed: eserviceTemplateApi.EServiceRiskAnalysisSeed =
      buildRiskAnalysisSeed(mockValidRiskAnalysis);

    await eserviceTemplateService.updateRiskAnalysis(
      eserviceTemplate.id,
      riskAnalysis1.id,
      riskAnalysisSeed,
      {
        authData: getMockAuthData(eserviceTemplate.creatorId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
          ...riskAnalysis2,
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
        {
          ...mockValidRiskAnalysis,
          id: unsafeBrandId(
            writtenPayload.eserviceTemplate!.riskAnalysis[1]!.id
          ),
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(
              writtenPayload.eserviceTemplate!.riskAnalysis[1]!
                .riskAnalysisForm!.id
            ),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.eserviceTemplate!.riskAnalysis[1]!.riskAnalysisForm!.singleAnswers.find(
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
                    writtenPayload.eserviceTemplate!.riskAnalysis[1]!.riskAnalysisForm!.multiAnswers.find(
                      (ma) => ma.key === multiAnswer.key
                    )!.id
                  ),
                })
              ),
          },
        },
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
    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(creatorTenantKind)),
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
  });
  it("should throw operationForbidden if the requester is not the creator", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const requesterId = generateId<TenantId>();
    await addOneTenant(getMockTenant(requesterId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(creatorTenantKind)),
        {
          authData: getMockAuthData(requesterId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceTemplateNotInDraftState if the eservice is not in draft state", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(creatorTenantKind)),
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateNotInDraftState(eserviceTemplate.id)
    );
  });
  it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await addOneTenant(getMockTenant(eserviceTemplate.creatorId));

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(creatorTenantKind)),
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(templateNotInReceiveMode(eserviceTemplate.id));
  });
  it("should throw tenantNotFound if the creator tenant doesn't exist", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
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
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(creatorTenantKind)),
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(eserviceTemplate.creatorId));
  });
  it("should throw tenantKindNotFound if the creator tenant kind doesn't exist", async () => {
    const creator: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
    const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PA);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      creatorId: creator.id,
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await addOneTenant(creator);

    expect(
      eserviceTemplateService.updateRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis1.id,
        buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
        {
          authData: getMockAuthData(creator.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantKindNotFound(creator.id));
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

    const riskAnalysis1 = getMockValidRiskAnalysis(creatorTenantKind);
    const riskAnalysis2 = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    const mockValidRiskAnalysis = {
      ...getMockValidRiskAnalysis(creatorTenantKind),
      id: riskAnalysis1.id,
      name: "updated name",
    };
    const riskAnalysisSeed: eserviceTemplateApi.EServiceRiskAnalysisSeed =
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
        riskAnalysis1.id,
        invalidRiskAnalysisSeed,
        {
          authData: getMockAuthData(creator.id),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
