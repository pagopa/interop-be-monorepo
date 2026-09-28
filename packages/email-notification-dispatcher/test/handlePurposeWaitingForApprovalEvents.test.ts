import {
  getMockContext,
  getMockPurpose,
  getMockTenant,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  generateId,
  toPurposeV2,
  PurposeEventEnvelope,
  PurposeWaitingForApprovalReasonV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneTenant,
  addOneEService,
  readModelService,
  templateService,
  getMockUser,
} from "./utils.js";

vi.mock(
  "../src/handlers/purposes/handlePurposeWaitingForApprovalToProducer.js",
  () => ({
    handlePurposeWaitingForApprovalToProducer: vi.fn().mockResolvedValue([]),
  })
);
vi.mock(
  "../src/handlers/purposes/handleNewPurposeVersionWaitingForApprovalToProducer.js",
  () => ({
    handleNewPurposeVersionWaitingForApprovalToProducer: vi
      .fn()
      .mockResolvedValue([]),
  })
);

describe("waiting-for-approval email event routing", () => {
  const tenant = getMockTenant();
  const eservice = getMockEService();
  const purpose = {
    ...getMockPurpose(),
    consumerId: tenant.id,
    eserviceId: eservice.id,
  };
  const user = getMockUser(tenant.id);
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(tenant);
    await addOneEService(eservice);
    vi.spyOn(
      readModelService,
      "getTenantUsersWithNotificationEnabled"
    ).mockResolvedValue([
      { userId: user.id, tenantId: tenant.id, userRoles: ["admin"] },
    ]);
  });

  it.each([
    "PurposeWaitingForApproval",
    "NewPurposeVersionWaitingForApproval",
    "PurposeVersionOverQuotaUnsuspended",
  ] as const)("forwards the reason for %s", async (type) => {
    const envelope = {
      event_version: 2 as const,
      stream_id: purpose.id,
      sequence_num: 1,
      version: 1,
      log_date: new Date(),
    };
    const data = {
      purpose: toPurposeV2(purpose),
      waitingForApprovalReason:
        PurposeWaitingForApprovalReasonV2.PURPOSE_WAITING_FOR_APPROVAL_REASON_DAILY_CALLS_TOTAL,
    };
    const decodedMessage: PurposeEventEnvelope =
      type === "PurposeWaitingForApproval"
        ? { ...envelope, type, data }
        : { ...envelope, type, data: { ...data, versionId: generateId() } };
    const messages = await handlePurposeEvent({
      decodedMessage,
      logger,
      readModelService,
      templateService,
      correlationId: generateId(),
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].email.subject).toBe(
      "Superamento soglie totali di chiamate API"
    );
    expect(messages[0].email.body).toContain(
      "sono già state superate le soglie totali"
    );
  });
});
