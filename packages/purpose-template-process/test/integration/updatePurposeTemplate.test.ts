import { fail } from "assert";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateAddedV2,
  purposeTemplateState,
  tenantKind,
  toPurposeTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent,
  writePurposeTemplateInEventstore,
} from "../integrationUtils.js";

describe("updatePurposeTemplate", () => {
  const riskAnalisysPAVersion = "3.0";
  const riskAnalisysPrivateVersion = "2.0";

  const existingPurposeTemplate: PurposeTemplate = getMockPurposeTemplate();
  const validPurposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed = {
    targetDescription: "Target description",
    targetTenantKind: tenantKind.PA,
    purposeTitle: "Purpose Template title",
    purposeDescription: "Purpose Template description",
    purposeIsFreeOfCharge: false,
  };

  it.each([
    { kind: tenantKind.PA, riskAnalysisVersion: riskAnalisysPAVersion },
    {
      kind: tenantKind.PRIVATE,
      riskAnalysisVersion: riskAnalisysPrivateVersion,
    },
  ])(
    "should successfully update a purpose template in draft state with valid data and targetTenantKind %s",
    async ({ kind, riskAnalysisVersion }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await addOnePurposeTemplate(existingPurposeTemplate);
      await writePurposeTemplateInEventstore(existingPurposeTemplate);

      const createPurposeTemplateResponse =
        await purposeTemplateService.createPurposeTemplate(
          {
            ...validPurposeTemplateSeed,
            targetTenantKind: kind,
            purposeTitle: "Updated Purpose Template title",
          },
          getMockContext({
            authData: getMockAuthData(existingPurposeTemplate.creatorId),
          })
        );

      const writtenEvent = await readLastPurposeTemplateEvent(
        createPurposeTemplateResponse.data.id
      );

      if (!writtenEvent) {
        fail("Creation failed: purpose template not found in event-store");
      }

      expect(writtenEvent).toMatchObject({
        stream_id: createPurposeTemplateResponse.data.id,
        version: "0",
        type: "PurposeTemplateDraftUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeTemplateAddedV2,
        payload: writtenEvent.data,
      });

      const expectedPurposeTemplate: PurposeTemplate = {
        id: unsafeBrandId(createPurposeTemplateResponse.data.id),
        createdAt: new Date(),
        targetDescription: validPurposeTemplateSeed.targetDescription,
        targetTenantKind: validPurposeTemplateSeed.targetTenantKind,
        creatorId: unsafeBrandId(existingPurposeTemplate.creatorId),
        state: purposeTemplateState.draft,
        purposeTitle: validPurposeTemplateSeed.purposeTitle,
        purposeDescription: validPurposeTemplateSeed.purposeDescription,
        purposeDailyCalls: validPurposeTemplateSeed.purposeDailyCalls,
        purposeIsFreeOfCharge: validPurposeTemplateSeed.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason:
          validPurposeTemplateSeed.purposeFreeOfChargeReason,
        purposeRiskAnalysisForm: {
          ...validPurposeTemplateSeed.purposeRiskAnalysisForm,
          id: expect.any(String),
          version: riskAnalysisVersion,
          singleAnswers: [],
          multiAnswers: [],
        },
      };

      expect(writtenPayload).toEqual({
        purposeTemplate: toPurposeTemplateV2(expectedPurposeTemplate),
      });
      expect(createPurposeTemplateResponse).toEqual({
        data: expectedPurposeTemplate,
        metadata: { version: 0 },
      });

      vi.useRealTimers();
    }
  );
});
