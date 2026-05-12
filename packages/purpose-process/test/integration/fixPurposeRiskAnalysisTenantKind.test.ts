/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect, vi } from "vitest";
import {
  Purpose,
  MaintenancePurposeRiskAnalysisSetTenantKindV2,
  RiskAnalysisId,
  TenantKind,
  tenantKind,
  toPurposeV2,
  generateId,
  PurposeId,
  EService,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  purposeNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenantKindHistory,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("fixPurposeRiskAnalysisTenantKind", () => {
  it("should write on event-store for the fix of a risk analysis tenant kind", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2024-01-10T10:00:00.000Z");
    vi.setSystemTime(baseTime);

    const consumerKind: TenantKind = tenantKind.PA;
    const consumer = getMockTenant();
    const eservice: EService = {
      ...getMockEService(),
      personalData: false,
    };

    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(consumerKind),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
      riskAnalysisForm,
      createdAt: baseTime,
    };

    await addOneEService(eservice);
    await addOnePurpose(purpose);

    await addOneTenantKindHistory({
      tenantId: consumer.id,
      metadataVersion: 0,
      kind: consumerKind,
      modifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    try {
      await purposeService.fixPurposeRiskAnalysisTenantKind(
        purpose.id,
        riskAnalysisId,
        getMockContextInternal({})
      );

      const writtenEvent = await readLastPurposeEvent(purpose.id);
      expect(writtenEvent).toMatchObject({
        stream_id: purpose.id,
        version: "1",
        type: "MaintenancePurposeRiskAnalysisSetTenantKind",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: MaintenancePurposeRiskAnalysisSetTenantKindV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = {
        ...purpose,
        riskAnalysisForm: {
          ...riskAnalysisForm,
          tenantKind: consumerKind,
        },
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      expect(writtenPayload.riskAnalysisId).toEqual(riskAnalysisId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Should throw tenantKindNotFound when history is empty", async () => {
    const consumerKind: TenantKind = tenantKind.PA;
    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(consumerKind),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      riskAnalysisForm,
    };

    await addOnePurpose(purpose);

    expect(
      purposeService.fixPurposeRiskAnalysisTenantKind(
        purpose.id,
        riskAnalysisId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(tenantKindNotFound(purpose.consumerId));
  });

  it("Should throw purposeNotFound when purpose doesn't exist", async () => {
    const unknownPurposeId = generateId<PurposeId>();
    const riskAnalysisId = generateId<RiskAnalysisId>();

    expect(
      purposeService.fixPurposeRiskAnalysisTenantKind(
        unknownPurposeId,
        riskAnalysisId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(purposeNotFound(unknownPurposeId));
  });
});
