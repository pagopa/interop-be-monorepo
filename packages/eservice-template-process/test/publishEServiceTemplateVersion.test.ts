/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidRiskAnalysis,
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
  RiskAnalysis,
  EServiceTemplateVersionId,
  eserviceMode,
} from "pagopa-interop-models";
import { expect, describe, it, afterAll, vi, beforeAll } from "vitest";
import {
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  missingTemplateVersionInterface,
  notValidEServiceTemplateVersionState,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "./utils.js";

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
      version: "2",
      interface: getMockDocument(),
      state: descriptorState.draft,
      publishedAt: undefined,
    };
    const olderEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: "1",
      interface: getMockDocument(),
      state: descriptorState.draft,
      publishedAt: undefined,
    };
    const newerEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: "3",
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
    };

    await addOneTenant({
      ...getMockTenant(eserviceTemplate.creatorId),
      kind: tenantKind.PA,
    });
    await addOneEServiceTemplate(eserviceTemplate);

    await eserviceTemplateService.publishEServiceTemplateVersion(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
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
    expect(writtenPayload.eserviceTemplate).toEqual(expectedEServiceTemplate);
  });

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", () => {
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
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
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(
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
          {
            authData: getMockAuthData(eserviceTemplate.creatorId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      missingTemplateVersionInterface(
        eserviceTemplate.id,
        eserviceTemplateVersion.id
      )
    );
  });

  it("should throw tenantNotFound if the eservice template creator doesn't exist", async () => {
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(eserviceTemplate.creatorId));
  });

  it("should throw tenantKindNotFound if the eservice template creator doesn't have a kind", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    const tenant = {
      ...getMockTenant(eserviceTemplate.creatorId),
      kind: undefined,
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantKindNotFound(eserviceTemplate.creatorId));
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(riskAnalysisValidationFailed([]));
  });

  it("should throw riskAnalysisValidationFailed if the eservice template mode is receive doesn't have a valid risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(tenant.kind);
    const invalidRiskAnalysis: RiskAnalysis = {
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(riskAnalysisValidationFailed([]));
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
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      await eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).equal(undefined);
  });

  it("shouldn't throw riskAnalysisValidationFailed if the eservice template mode isn't receive even if doesn't have a valid risk analysis", async () => {
    const tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
    };

    const mockValidRiskAnalysis = getMockValidRiskAnalysis(tenant.kind);
    const invalidRiskAnalysis: RiskAnalysis = {
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
    };

    await addOneTenant(tenant);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      await eserviceTemplateService.publishEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).equal(undefined);
  });
});
