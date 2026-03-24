/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateRiskAnalysisFixedV2,
  RiskAnalysis,
  TenantKind,
  tenantKind,
  toEServiceTemplateV2,
  generateId,
  EServiceTemplateId,
  RiskAnalysisId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEServiceTemplate,
  getMockValidEServiceTemplateRiskAnalysis,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateNotFound,
  riskAnalysisNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("fixEServiceTemplateRiskAnalysisTenantKind", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the fix of a template risk analysis tenant kind", async () => {
    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );

    const riskAnalysisToFix: RiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);
    const riskAnalysisOther: RiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      riskAnalysis: [riskAnalysisOther, riskAnalysisToFix],
    };

    await addOneEServiceTemplate(template);

    await eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind(
      template.id,
      riskAnalysisToFix.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceTemplateEvent(template.id);
    expect(writtenEvent).toMatchObject({
      stream_id: template.id,
      version: "1",
      type: "EServiceTemplateRiskAnalysisFixed",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateRiskAnalysisFixedV2,
      payload: writtenEvent.data,
    });

    const fixedRiskAnalysis: RiskAnalysis = {
      ...riskAnalysisToFix,
      riskAnalysisForm: {
        ...riskAnalysisToFix.riskAnalysisForm,
        tenantKind: creatorTenantKind,
      },
    };

    const expectedTemplate: EServiceTemplate = {
      ...template,
      riskAnalysis: [riskAnalysisOther, fixedRiskAnalysis],
    };

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedTemplate)
    );
  });

  it("should throw eserviceTemplateNotFound when template does not exist", async () => {
    const templateId = generateId<EServiceTemplateId>();
    const riskAnalysisId = generateId<RiskAnalysisId>();

    await expect(
      eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind(
        templateId,
        riskAnalysisId,
        getMockContextInternal({})
      )
    ).rejects.toThrow(eserviceTemplateNotFound(templateId));
  });

  it("should throw riskAnalysisNotFound when risk analysis does not exist", async () => {
    const creatorTenantKind: TenantKind = tenantKind.PA;
    const riskAnalysisToFix: RiskAnalysis =
      getMockValidEServiceTemplateRiskAnalysis(creatorTenantKind);

    const template: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      riskAnalysis: [riskAnalysisToFix],
    };

    await addOneEServiceTemplate(template);

    const missingRiskAnalysisId = generateId<RiskAnalysisId>();

    await expect(
      eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind(
        template.id,
        missingRiskAnalysisId,
        getMockContextInternal({})
      )
    ).rejects.toThrow(riskAnalysisNotFound(template.id, missingRiskAnalysisId));
  });
});
