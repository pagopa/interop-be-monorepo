/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect, vi } from "vitest";
import {
  EService,
  MaintenanceEServiceRiskAnalysisSetTenandKindV2,
  RiskAnalysis,
  TenantKind,
  tenantKind,
  toEServiceV2,
  generateId,
  EServiceId,
  RiskAnalysisId,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockTenant,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  eServiceNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneTenantKindHistory,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("fixEServiceRiskAnalysisTenantKind", () => {
  it("should write on event-store for the fix of a risk analysis tenant kind", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2024-01-10T10:00:00.000Z");
    vi.setSystemTime(baseTime);

    const producerKind: TenantKind = tenantKind.PA;
    const producer = getMockTenant();
    const riskAnalysisToFix: RiskAnalysis =
      getMockValidRiskAnalysis(producerKind);
    const riskAnalysisOther: RiskAnalysis =
      getMockValidRiskAnalysis(producerKind);

    riskAnalysisToFix.createdAt = new Date("2024-01-10T10:00:00.000Z");
    riskAnalysisToFix.riskAnalysisForm = {
      ...riskAnalysisToFix.riskAnalysisForm,
      tenantKind: undefined,
    };
    riskAnalysisOther.createdAt = new Date("2024-01-09T10:00:00.000Z");

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      riskAnalysis: [riskAnalysisOther, riskAnalysisToFix],
    };

    await addOneEService(eservice);

    await addOneTenantKindHistory({
      tenantId: producer.id,
      metadataVersion: 0,
      kind: producerKind,
      modifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    try {
      await catalogService.fixEServiceRiskAnalysisTenantKind(
        eservice.id,
        riskAnalysisToFix.id,
        getMockContextInternal({})
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "MaintenanceEServiceRiskAnalysisSetTenandKind",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: MaintenanceEServiceRiskAnalysisSetTenandKindV2,
        payload: writtenEvent.data,
      });

      const fixedRiskAnalysis: RiskAnalysis = {
        ...riskAnalysisToFix,
        riskAnalysisForm: {
          ...riskAnalysisToFix.riskAnalysisForm,
          tenantKind: producerKind,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        riskAnalysis: [riskAnalysisOther, fixedRiskAnalysis],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    } finally {
      vi.useRealTimers();
    }
  });

  it("Should throw tenantKindNotFound when history is empty", async () => {
    const producerKind: TenantKind = tenantKind.PA;
    const riskAnalysisToFix: RiskAnalysis =
      getMockValidRiskAnalysis(producerKind);
    riskAnalysisToFix.riskAnalysisForm = {
      ...riskAnalysisToFix.riskAnalysisForm,
      tenantKind: undefined,
    };

    const eservice: EService = {
      ...getMockEService(),
      riskAnalysis: [riskAnalysisToFix],
    };

    await addOneEService(eservice);

    expect(
      catalogService.fixEServiceRiskAnalysisTenantKind(
        eservice.id,
        riskAnalysisToFix.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(tenantKindNotFound(eservice.producerId));
  });

  it("Should throw eServiceNotFound when eService doesn't exist", async () => {
    const unknownEServiceId = generateId<EServiceId>();
    const riskAnalysisId = generateId<RiskAnalysisId>();

    expect(
      catalogService.fixEServiceRiskAnalysisTenantKind(
        unknownEServiceId,
        riskAnalysisId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(eServiceNotFound(unknownEServiceId));
  });
});
