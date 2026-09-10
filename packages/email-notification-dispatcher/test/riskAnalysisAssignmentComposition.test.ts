import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeEventEnvelope,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import {
  insertTenantNotificationConfig,
  insertUserNotificationConfig,
} from "pagopa-interop-readmodel/testUtils";
import { beforeEach, describe, expect, it } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
  templateService,
} from "./utils.js";

describe("risk analysis assignment notification composition", () => {
  const producer = getMockTenant();
  const consumer = getMockTenant();
  const eservice = { ...getMockEService(), producerId: producer.id };
  const purpose = {
    ...getMockPurpose(),
    consumerId: consumer.id,
    eserviceId: eservice.id,
  };
  const newReviewerId = generateId<UserId>();
  const oldReviewerId = generateId<UserId>();
  const { logger, correlationId } = getMockContext({});
  const removalType = "purposeRiskAnalysisAssignmentRemovedToReviewer";
  const events = [
    {
      type: "PurposeRiskAnalysisWorkflowCreated",
      notificationType: "purposeRiskAnalysisAssignedForSigningToReviewer",
      subject: "Hai un'analisi del rischio da approvare",
    },
    {
      type: "PurposeRiskAnalysisAssigned",
      notificationType:
        "purposeRiskAnalysisAssignedForWritingAndSigningToReviewer",
      subject: "Hai un'analisi del rischio da compilare e approvare",
    },
  ] as const;

  beforeEach(async () => {
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await insertTenantNotificationConfig(
      readModelDB,
      {
        ...getMockTenantNotificationConfig(),
        tenantId: consumer.id,
        enabled: true,
      },
      1
    );
  });

  describe.each(events)("$type", ({ type, notificationType, subject }) => {
    it.each([
      {
        name: "both recipient lists",
        hasNew: true,
        hasOld: true,
        newEnabled: true,
        oldEnabled: true,
      },
      {
        name: "empty new list",
        hasNew: false,
        hasOld: true,
        newEnabled: true,
        oldEnabled: true,
      },
      {
        name: "empty old list",
        hasNew: true,
        hasOld: false,
        newEnabled: true,
        oldEnabled: true,
      },
      {
        name: "both lists empty",
        hasNew: false,
        hasOld: false,
        newEnabled: true,
        oldEnabled: true,
      },
      {
        name: "assignment preference disabled",
        hasNew: true,
        hasOld: true,
        newEnabled: false,
        oldEnabled: true,
      },
      {
        name: "removal preference disabled",
        hasNew: true,
        hasOld: true,
        newEnabled: true,
        oldEnabled: false,
      },
    ])(
      "dispatches the expected notifications with $name",
      async ({ hasNew, hasOld, newEnabled, oldEnabled }) => {
        for (const userId of [newReviewerId, oldReviewerId]) {
          const config = getMockUserNotificationConfig();
          await insertUserNotificationConfig(
            readModelDB,
            {
              ...config,
              userId,
              tenantId: consumer.id,
              userRoles: [authRole.REVIEWER_ROLE],
              emailNotificationPreference: true,
              emailConfig: {
                ...config.emailConfig,
                [notificationType]: newEnabled,
                [removalType]: oldEnabled,
              },
            },
            1
          );
        }
        const event: PurposeEventEnvelope = {
          event_version: 2,
          type,
          data: {
            purpose: toPurposeV2(purpose),
            newReviewersToNotify: hasNew ? [newReviewerId] : [],
            oldReviewersToNotify: hasOld ? [oldReviewerId] : [],
          },
          sequence_num: 1,
          stream_id: purpose.id,
          version: 1,
          log_date: new Date(),
        };
        const notifications = await handlePurposeEvent({
          decodedMessage: event,
          logger,
          correlationId,
          readModelService,
          templateService,
        });
        const expected = [
          ...(hasNew && newEnabled
            ? [{ userId: newReviewerId, kind: subject }]
            : []),
          ...(hasOld && oldEnabled
            ? [
                {
                  userId: oldReviewerId,
                  kind: "L'assegnazione dell'analisi del rischio è stata rimossa",
                },
              ]
            : []),
        ];
        expect(notifications).toHaveLength(expected.length);
        expect(
          notifications.map((notification) => ({
            userId:
              notification.type === "User" ? notification.userId : undefined,
            kind: notification.email.subject,
          }))
        ).toEqual(expect.arrayContaining(expected));
      }
    );
  });
});
