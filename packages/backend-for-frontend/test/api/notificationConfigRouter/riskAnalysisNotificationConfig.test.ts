import { generateMock } from "@anatine/zod-mock";
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

const groups = [
  {
    key: "purposeRiskAnalysisAssignmentStatusToAdmin",
    role: authRole.ADMIN_ROLE,
    types: [
      "purposeRiskAnalysisSignedToAdmin",
      "purposeRiskAnalysisRejectedToAdmin",
    ],
  },
  {
    key: "purposeRiskAnalysisAssignmentStatusToReviewer",
    role: authRole.REVIEWER_ROLE,
    types: [
      "purposeRiskAnalysisAssignedForSigningToReviewer",
      "purposeRiskAnalysisAssignedForWritingAndSigningToReviewer",
      "purposeRiskAnalysisAssignmentRemovedToReviewer",
      "draftPurposeDeletedWithRiskAnalysisToReviewer",
      "purposeRiskAnalysisSignedToReviewer",
    ],
  },
  {
    key: "purposePublishedWithRiskAnalysisToReviewer",
    role: authRole.REVIEWER_ROLE,
    types: ["purposePublishedWithRiskAnalysisToReviewer"],
  },
] as const;

const disabledProcessConfig = notificationConfigApi.NotificationConfig.parse(
  Object.fromEntries(
    Object.keys(notificationConfigApi.NotificationConfig.shape).map((key) => [
      key,
      false,
    ])
  )
);

describe("risk analysis notification preference groups", () => {
  beforeEach(() => {
    clients.notificationConfigProcessClient.updateUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  describe.each(groups)("$key", ({ key, role, types }) => {
    it.each(types)(
      "GET enables only the group containing %s, independently per channel",
      async (type) => {
        clients.notificationConfigProcessClient.getUserNotificationConfig = vi
          .fn()
          .mockResolvedValue({
            ...generateMock(notificationConfigApi.UserNotificationConfig),
            inAppConfig: { ...disabledProcessConfig, [type]: true },
            emailConfig: disabledProcessConfig,
          });

        const res = await request(api)
          .get(`${appBasePath}/userNotificationConfigs`)
          .set("Authorization", `Bearer ${generateToken(role)}`)
          .set("X-Correlation-Id", generateId());

        expect(res.status).toBe(200);
        for (const group of groups) {
          expect(res.body.inAppConfig[group.key]).toBe(group.key === key);
          expect(res.body.emailConfig[group.key]).toBe(false);
        }
        for (const group of groups.slice(0, 2)) {
          for (const individualType of group.types) {
            expect(res.body.inAppConfig).not.toHaveProperty(individualType);
            expect(res.body.emailConfig).not.toHaveProperty(individualType);
          }
        }
      }
    );

    it.each([false, true])(
      "POST expands the group to all its preferences with value %s",
      async (enabled) => {
        const disabledBffConfig = Object.fromEntries(
          Object.keys(generateMock(bffApi.NotificationConfig)).map((field) => [
            field,
            false,
          ])
        );
        const seed = {
          inAppNotificationPreference: true,
          emailNotificationPreference: true,
          emailDigestPreference: false,
          inAppConfig: { ...disabledBffConfig, [key]: enabled },
          emailConfig: { ...disabledBffConfig, [key]: !enabled },
        };
        const res = await request(api)
          .post(`${appBasePath}/userNotificationConfigs`)
          .set("Authorization", `Bearer ${generateToken(role)}`)
          .set("X-Correlation-Id", generateId())
          .send(seed);

        expect(res.status).toBe(204);
        expect(
          clients.notificationConfigProcessClient.updateUserNotificationConfig
        ).toHaveBeenCalledWith(
          {
            ...seed,
            inAppConfig: {
              ...disabledProcessConfig,
              ...Object.fromEntries(types.map((type) => [type, enabled])),
            },
            emailConfig: {
              ...disabledProcessConfig,
              ...Object.fromEntries(types.map((type) => [type, !enabled])),
            },
          },
          expect.any(Object)
        );
      }
    );
  });
});
