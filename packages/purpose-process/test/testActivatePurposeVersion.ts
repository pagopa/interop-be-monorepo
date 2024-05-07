/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  PurposeArchivedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeVersionNotFound,
  notValidVersionState,
  tenantKindNotFound,
  missingRiskAnalysis,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  purposes,
  purposeService,
} from "./purposeService.integration.test.js";
import { addOnePurpose, prepareReadModelForPurposeTest } from "./utils.js";

export const testActivatePurposeVersion = (): ReturnType<typeof describe> =>
  describe("activatePurposeVersion", () => {
    it("should throw error if the purpose consumer has no kind", async () => {
      const { mockPurpose, mockPurposeVersion, mockConsumer } =
        await prepareReadModelForPurposeTest({
          consumer: { kind: undefined },
        });

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(mockConsumer.id));
    });

    it("should throw if the purpose has no risk analysis", async () => {
      const { mockPurpose, mockPurposeVersion, mockConsumer } =
        await prepareReadModelForPurposeTest({
          purpose: { riskAnalysisForm: undefined },
        });

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
    });
  });
