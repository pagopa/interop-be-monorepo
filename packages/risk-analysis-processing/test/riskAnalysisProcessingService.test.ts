import { RefreshableInteropToken } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getInteropBeClients } from "../src/clients/clientsProvider.js";
import { riskAnalysisProcessingServiceBuilder } from "../src/services/riskAnalysisProcessingService.js";
import { readModelService } from "./utils.js";

describe("riskAnalysisProcessingService", () => {
  const testCorrelationId = generateId();
  const testToken = "mockToken";
  const purposeProcessClient = getInteropBeClients().purposeProcess.client;
  const mockRefreshableToken = {
    get: () => Promise.resolve({ serialized: testToken }),
  } as unknown as RefreshableInteropToken;

  beforeEach(() => {
    purposeProcessClient.fixReviewerWorkflow = vi.fn();
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
    purposeProcessClient.fixReviewerWorkflow.mock.calls.forEach((call) => {
      expect(legacyPurposeIds).toContain(call[1].params.purposeId);
    });
  });
});
