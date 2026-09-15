/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockPurpose,
} from "pagopa-interop-commons-test";
import {
  MaintenancePurposeRiskAnalysisFixReviewerWorkflowV2,
  Purpose,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  addOnePurpose,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("fixReviewerWorkflow", () => {
  it("emits a maintenance event with the normalized review mode", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      reviewMode: "AdminWritesReviewerSigns",
    };

    await addOnePurpose(purpose);

    await purposeService.fixReviewerWorkflow(
      purpose.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "MaintenancePurposeRiskAnalysisFixReviewerWorkflow",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenancePurposeRiskAnalysisFixReviewerWorkflowV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose?.reviewMode).toBe(1);
  });
});