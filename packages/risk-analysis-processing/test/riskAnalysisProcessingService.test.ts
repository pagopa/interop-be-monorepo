import { RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getInteropBeClients } from "../src/clients/clientsProvider.js";
import { riskAnalysisProcessingServiceBuilder } from "../src/services/riskAnalysisProcessingService.js";
import { readModelService } from "./utils.js";

describe("riskAnalysisProcessingService", () => {
  const testCorrelationId = generateId<CorrelationId>();
  const testToken = "mockToken";
  const purposeProcessClient = getInteropBeClients().purposeProcess.client;
  const fixReviewerWorkflow = vi.fn();
  const mockRefreshableToken = {
    get: () => Promise.resolve({ serialized: testToken }),
  } as unknown as RefreshableInteropToken;

  beforeEach(() => {
    purposeProcessClient.fixReviewerWorkflow = fixReviewerWorkflow;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls the reviewer workflow migration endpoint for each legacy purpose", async () => {
    const legacyPurposeIds = [generateId(), generateId()];
    readModelService.getAllReadModelPurposeIdsWithLegacyReviewMode = vi
      .fn()
      .mockResolvedValue(legacyPurposeIds);

    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      purposeProcessClient,
      mockRefreshableToken,
      testCorrelationId
    );

    await riskAnalysisProcessingService.processPurposeReviewerWorkflows();

    expect(purposeProcessClient.fixReviewerWorkflow).toHaveBeenCalledTimes(
      legacyPurposeIds.length
    );
    for (const purposeId of legacyPurposeIds) {
      expect(fixReviewerWorkflow).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ params: { purposeId } })
      );
    }
  });
});
