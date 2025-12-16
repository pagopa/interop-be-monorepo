/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { rulesVersionNotFoundError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidEServiceTemplateRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  toEServiceTemplateV2,
  operationForbidden,
  generateId,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplateVersionPublishedV2,
  tenantKind,
  EServiceTemplateVersionId,
  eserviceMode,
  EServiceTemplateRiskAnalysis,
} from "pagopa-interop-models";
import { expect, describe, it, afterAll, vi, beforeAll } from "vitest";
import {
  eserviceTemplateNotFound,
  missingPersonalDataFlag,
  eserviceTemplateVersionNotFound,
  missingRiskAnalysis,
  missingTemplateVersionInterface,
  notValidEServiceTemplateVersionState,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "../integrationUtils.js";

describe("publishEServiceTemplateVersion", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the publication of a eservice template version", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      interface: getMockDocument(),
      state: descriptorState.draft,
      publishedAt: undefined,
    };
    const olderEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      interface: getMockDocument(),
      state: descriptorState.draft,
      publishedAt: undefined,
    };
    const newerEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 3,
      interface: getMockDocument(),
      state: descriptorState.draft,
      publishedAt: undefined,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        olderEServiceTemplateVersion,
        eserviceTemplateVersion,
        newerEServiceTemplateVersion,
      ],
      personalData: false,
    };

    await addOneTenant({
      ...getMockTenant(eserviceTemplate.creatorId),
      kind: tenantKind.PA,
    });
    await addOneEServiceTemplate(eserviceTemplate);

    await eserviceTemplateService.publishEServiceTemplateVersion(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateVersionPublished");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        {
          ...olderEServiceTemplateVersion,
          state: descriptorState.deprecated,
          deprecatedAt: mockDate,
        },
        {
          ...eserviceTemplateVersion,
          state: descriptorState.published,
          publishedAt: mockDate,
        },
        newerEServiceTemplateVersion,
      ],
    });

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.eserviceTemplate).toEqual({
      ...expectedEServiceTemplate,
      versions: expect.arrayContaining(expectedEServiceTemplate.versions),
    });
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the eservice template creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [],
    };
    const eserviceTemplateVersionId: EServiceTemplateVersionId = generateId();
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionId,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eserviceTemplate.id,
        eserviceTemplateVersionId
      )
    );
  });

  it.each([
    eserviceTemplateVersionState.suspended,
    descriptorState.published,
    eserviceTemplateVersionState.deprecated,
  ])(
    "should throw notValidEServiceTemplateVersionState if the descriptor is in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      expect(
        eserviceTemplateService.publishEServiceTemplateVersion(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(eserviceTemplateVersion.id, state)
      );
    }
  );

  it("should throw missingTemplateVersionInterface if the eservice template version doesn't have an interface", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: descriptorState.draft,
      interface: undefined,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      missingTemplateVersionInterface(
        eserviceTemplate.id,
        eserviceTemplateVersion.id
      )
    );
  });

  it("should throw riskAnalysisValidationFailed if the eservice template mode is receive and doesn't have any risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
      riskAnalysis: [],
      creatorId: tenant.id,
      mode: eserviceMode.receive,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(missingRiskAnalysis(eserviceTemplate.id));
  });

  it("should throw riskAnalysisValidationFailed if the eservice template mode is receive doesn't have a valid risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockValidRiskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
      tenant.kind
    );
    const invalidRiskAnalysis: EServiceTemplateRiskAnalysis = {
      ...mockValidRiskAnalysis,
      riskAnalysisForm: {
        ...mockValidRiskAnalysis.riskAnalysisForm,
        version: "0",
      },
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
      riskAnalysis: [invalidRiskAnalysis],
      creatorId: tenant.id,
      mode: eserviceMode.receive,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(tenantKind.PA, "0"),
      ])
    );
  });

  it("shouldn't throw riskAnalysisValidationFailed if the eservice template mode isn't reveive even if doesn't have any risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
      riskAnalysis: [],
      creatorId: tenant.id,
      mode: eserviceMode.deliver,
      personalData: false,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).resolves.not.toThrowError();
  });

  it("shouldn't throw riskAnalysisValidationFailed if the eservice template mode isn't receive even if doesn't have a valid risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockValidRiskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
      tenant.kind
    );
    const invalidRiskAnalysis = {
      ...mockValidRiskAnalysis,
      riskAnalysisForm: {
        ...mockValidRiskAnalysis.riskAnalysisForm,
        version: "0",
      },
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
      riskAnalysis: [invalidRiskAnalysis],
      creatorId: tenant.id,
      mode: eserviceMode.deliver,
      personalData: false,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).resolves.not.toThrowError();
  });

  it("should throw missingPersonalDataFlag if the template has personalData undefined", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: descriptorState.draft,
      interface: getMockDocument(),
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
      personalData: undefined,
    };

    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      missingPersonalDataFlag(eserviceTemplate.id, eserviceTemplateVersion.id)
    );
  });
});
