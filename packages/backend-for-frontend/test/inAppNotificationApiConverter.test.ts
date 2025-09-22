/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import { inAppNotificationApi, bffApi } from "pagopa-interop-api-clients";
import {
  toBffApiNotificationsCountBySection,
  toBffApiNotifications,
} from "../src/api/inAppNotificationApiConverter.js";
import { getMockNotification } from "./utils.js";

describe("toBffApiNotificationsCountBySection", () => {
  it("should correctly transform notification counts with all sections having data", () => {
    const input: inAppNotificationApi.NotificationsByType = {
      totalCount: 100,
      results: {
        // Erogazione - richieste
        agreementManagementToProducer: 5,
        agreementSuspendedUnsuspendedToProducer: 3,
        // Erogazione - finalita
        clientAddedRemovedToProducer: 2,
        purposeStatusChangedToProducer: 4,
        // Erogazione - template-eservice
        templateStatusChangedToProducer: 1,
        // Erogazione - e-service
        newEserviceTemplateVersionToInstantiator: 6,
        eserviceTemplateNameChangedToInstantiator: 2,
        eserviceTemplateStatusChangedToInstantiator: 1,
        // Erogazione - portachiavi
        clientKeyAddedDeletedToClientUsers: 7,
        // Fruizione - richieste
        agreementActivatedRejectedToConsumer: 8,
        agreementSuspendedUnsuspendedToConsumer: 2,
        // Fruizione - finalita
        purposeActivatedRejectedToConsumer: 3,
        purposeSuspendedUnsuspendedToConsumer: 1,
        // Catalogo e-service
        eserviceStateChangedToConsumer: 5,
        // Aderente - deleghe
        delegationApprovedRejectedToDelegator: 4,
        eserviceNewVersionSubmittedToDelegator: 2,
        eserviceNewVersionApprovedRejectedToDelegate: 1,
        delegationSubmittedRevokedToDelegate: 3,
        // Aderente - anagrafica
        certifiedVerifiedAttributeAssignedRevokedToAssignee: 6,
      },
    };

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 8, // 5 + 3
        finalita: 6, // 2 + 4
        "template-eservice": 1,
        "e-service": 9, // 6 + 2 + 1
        portachiavi: 7,
        totalCount: 31, // 8 + 6 + 1 + 9 + 7
      },
      fruizione: {
        richieste: 10, // 8 + 2
        finalita: 4, // 3 + 1
        totalCount: 14, // 10 + 4
      },
      "catalogo-e-service": {
        totalCount: 5,
      },
      aderente: {
        deleghe: 10, // 4 + 2 + 1 + 3
        anagrafica: 6,
        totalCount: 16, // 10 + 6
      },
      "gestione-client": {
        "api-e-service": 7, // same as clientKeyAddedDeletedToClientUsers
        totalCount: 7,
      },
      totalCount: 100,
    };

    expect(result).toEqual(expected);
  });

  it("should handle empty results object", () => {
    const input: inAppNotificationApi.NotificationsByType = {
      totalCount: 0,
      results: {},
    };

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 0,
        finalita: 0,
        "template-eservice": 0,
        "e-service": 0,
        portachiavi: 0,
        totalCount: 0,
      },
      fruizione: {
        richieste: 0,
        finalita: 0,
        totalCount: 0,
      },
      "catalogo-e-service": {
        totalCount: 0,
      },
      aderente: {
        deleghe: 0,
        anagrafica: 0,
        totalCount: 0,
      },
      "gestione-client": {
        "api-e-service": 0,
        totalCount: 0,
      },
      totalCount: 0,
    };

    expect(result).toEqual(expected);
  });

  it("should handle missing results property", () => {
    const input = {
      totalCount: 0,
    } as unknown as inAppNotificationApi.NotificationsByType;

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 0,
        finalita: 0,
        "template-eservice": 0,
        "e-service": 0,
        portachiavi: 0,
        totalCount: 0,
      },
      fruizione: {
        richieste: 0,
        finalita: 0,
        totalCount: 0,
      },
      "catalogo-e-service": {
        totalCount: 0,
      },
      aderente: {
        deleghe: 0,
        anagrafica: 0,
        totalCount: 0,
      },
      "gestione-client": {
        "api-e-service": 0,
        totalCount: 0,
      },
      totalCount: 0,
    };

    expect(result).toEqual(expected);
  });

  it("should handle partial notification types", () => {
    const input: inAppNotificationApi.NotificationsByType = {
      totalCount: 25,
      results: {
        // Only some notification types present
        agreementManagementToProducer: 10,
        purposeActivatedRejectedToConsumer: 5,
        eserviceStateChangedToConsumer: 3,
        delegationApprovedRejectedToDelegator: 7,
      },
    };

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 10, // only agreementManagementToProducer
        finalita: 0,
        "template-eservice": 0,
        "e-service": 0,
        portachiavi: 0,
        totalCount: 10,
      },
      fruizione: {
        richieste: 0,
        finalita: 5, // only purposeActivatedRejectedToConsumer
        totalCount: 5,
      },
      "catalogo-e-service": {
        totalCount: 3,
      },
      aderente: {
        deleghe: 7, // only delegationApprovedRejectedToDelegator
        anagrafica: 0,
        totalCount: 7,
      },
      "gestione-client": {
        "api-e-service": 0,
        totalCount: 0,
      },
      totalCount: 25,
    };

    expect(result).toEqual(expected);
  });

  it("should handle notification types with zero values", () => {
    const input: inAppNotificationApi.NotificationsByType = {
      totalCount: 15,
      results: {
        agreementManagementToProducer: 0,
        agreementSuspendedUnsuspendedToProducer: 5,
        clientAddedRemovedToProducer: 0,
        purposeStatusChangedToProducer: 10,
        templateStatusChangedToProducer: 0,
      },
    };

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 5, // 0 + 5
        finalita: 10, // 0 + 10
        "template-eservice": 0,
        "e-service": 0,
        portachiavi: 0,
        totalCount: 15,
      },
      fruizione: {
        richieste: 0,
        finalita: 0,
        totalCount: 0,
      },
      "catalogo-e-service": {
        totalCount: 0,
      },
      aderente: {
        deleghe: 0,
        anagrafica: 0,
        totalCount: 0,
      },
      "gestione-client": {
        "api-e-service": 0,
        totalCount: 0,
      },
      totalCount: 15,
    };

    expect(result).toEqual(expected);
  });

  it("should handle shared notification types correctly", () => {
    // clientKeyAddedDeletedToClientUsers appears in both erogazione.portachiavi and gestione-client.api-e-service
    const input: inAppNotificationApi.NotificationsByType = {
      totalCount: 20,
      results: {
        clientKeyAddedDeletedToClientUsers: 20,
      },
    };

    const result = toBffApiNotificationsCountBySection(input);

    const expected: bffApi.NotificationsCountBySection = {
      erogazione: {
        richieste: 0,
        finalita: 0,
        "template-eservice": 0,
        "e-service": 0,
        portachiavi: 20,
        totalCount: 20,
      },
      fruizione: {
        richieste: 0,
        finalita: 0,
        totalCount: 0,
      },
      "catalogo-e-service": {
        totalCount: 0,
      },
      aderente: {
        deleghe: 0,
        anagrafica: 0,
        totalCount: 0,
      },
      "gestione-client": {
        "api-e-service": 20, // same notification type used here too
        totalCount: 20,
      },
      totalCount: 20,
    };

    expect(result).toEqual(expected);
  });
});

describe("calculateDeepLink (via toBffApiNotifications)", () => {
  describe("should generate correct deep links for notification types with subsections", () => {
    it("should handle erogazione richieste notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 2,
        results: [
          getMockNotification("agreementManagementToProducer", "agreement-123"),
          getMockNotification(
            "agreementSuspendedUnsuspendedToProducer",
            "agreement-456"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/richieste/agreement-123"
      );
      expect(result.results[1].deepLink).toBe(
        "/erogazione/richieste/agreement-456"
      );
    });

    it("should handle erogazione finalita notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 2,
        results: [
          getMockNotification("clientAddedRemovedToProducer", "client-123"),
          getMockNotification("purposeStatusChangedToProducer", "purpose-456"),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/finalita/client-123"
      );
      expect(result.results[1].deepLink).toBe(
        "/erogazione/finalita/purpose-456"
      );
    });

    it("should handle erogazione template-eservice notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification(
            "templateStatusChangedToProducer",
            "template-123"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/template-eservice/template-123"
      );
    });

    it("should handle erogazione e-service notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 3,
        results: [
          getMockNotification(
            "newEserviceTemplateVersionToInstantiator",
            "eservice-123"
          ),
          getMockNotification(
            "eserviceTemplateNameChangedToInstantiator",
            "eservice-456"
          ),
          getMockNotification(
            "eserviceTemplateStatusChangedToInstantiator",
            "eservice-789"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/e-service/eservice-123"
      );
      expect(result.results[1].deepLink).toBe(
        "/erogazione/e-service/eservice-456"
      );
      expect(result.results[2].deepLink).toBe(
        "/erogazione/e-service/eservice-789"
      );
    });

    it("should handle erogazione portachiavi notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification(
            "clientKeyAddedDeletedToClientUsers",
            "client-key-123"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/portachiavi/client-key-123"
      );
    });

    it("should handle fruizione richieste notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 2,
        results: [
          getMockNotification(
            "agreementActivatedRejectedToConsumer",
            "agreement-123"
          ),
          getMockNotification(
            "agreementSuspendedUnsuspendedToConsumer",
            "agreement-456"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/fruizione/richieste/agreement-123"
      );
      expect(result.results[1].deepLink).toBe(
        "/fruizione/richieste/agreement-456"
      );
    });

    it("should handle fruizione finalita notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 2,
        results: [
          getMockNotification(
            "purposeActivatedRejectedToConsumer",
            "purpose-123"
          ),
          getMockNotification(
            "purposeSuspendedUnsuspendedToConsumer",
            "purpose-456"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/fruizione/finalita/purpose-123"
      );
      expect(result.results[1].deepLink).toBe(
        "/fruizione/finalita/purpose-456"
      );
    });

    it("should handle aderente deleghe notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 4,
        results: [
          getMockNotification(
            "delegationApprovedRejectedToDelegator",
            "delegation-123"
          ),
          getMockNotification(
            "eserviceNewVersionSubmittedToDelegator",
            "eservice-456"
          ),
          getMockNotification(
            "eserviceNewVersionApprovedRejectedToDelegate",
            "eservice-789"
          ),
          getMockNotification(
            "delegationSubmittedRevokedToDelegate",
            "delegation-101"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/aderente/deleghe/delegation-123"
      );
      expect(result.results[1].deepLink).toBe("/aderente/deleghe/eservice-456");
      expect(result.results[2].deepLink).toBe("/aderente/deleghe/eservice-789");
      expect(result.results[3].deepLink).toBe(
        "/aderente/deleghe/delegation-101"
      );
    });

    it("should handle aderente anagrafica notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification(
            "certifiedVerifiedAttributeAssignedRevokedToAssignee",
            "attribute-123"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/aderente/anagrafica/attribute-123"
      );
    });

    // eslint-disable-next-line sonarjs/no-identical-functions
    it("should handle gestione-client api-e-service notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification(
            "clientKeyAddedDeletedToClientUsers",
            "client-key-123"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      // Note: This notification type appears in both erogazione.portachiavi and gestione-client.api-e-service
      // The function will return the first match found (erogazione.portachiavi)
      expect(result.results[0].deepLink).toBe(
        "/erogazione/portachiavi/client-key-123"
      );
    });
  });

  describe("should generate correct deep links for notification types with section only", () => {
    it("should handle catalogo-e-service notifications", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification("eserviceStateChangedToConsumer", "eservice-123"),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe("/catalogo-e-service");
    });
  });

  describe("should handle unknown notification types", () => {
    it("should return root path for unknown notification types", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 2,
        results: [
          getMockNotification("unknownNotificationType", "entity-123"),
          getMockNotification("anotherUnknownType", "entity-456"),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe("/");
      expect(result.results[1].deepLink).toBe("/");
    });
  });

  describe("should handle edge cases", () => {
    it("should work with empty entityId", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [getMockNotification("agreementManagementToProducer", "")],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe("/erogazione/richieste/");
    });

    it("should work with special characters in entityId", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [
          getMockNotification(
            "agreementManagementToProducer",
            "entity-123-abc_def"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/richieste/entity-123-abc_def"
      );
    });

    it("should preserve all notification properties while adding deepLink", () => {
      const originalNotification = getMockNotification(
        "agreementManagementToProducer",
        "test-entity"
      );
      originalNotification.readAt = "2024-01-02T00:00:00Z";

      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 1,
        results: [originalNotification],
      };

      const result = toBffApiNotifications(notifications);
      const transformedNotification = result.results[0];

      expect(transformedNotification.id).toBe(originalNotification.id);
      expect(transformedNotification.tenantId).toBe(
        originalNotification.tenantId
      );
      expect(transformedNotification.userId).toBe(originalNotification.userId);
      expect(transformedNotification.body).toBe(originalNotification.body);
      expect(transformedNotification.createdAt).toBe(
        originalNotification.createdAt
      );
      expect(transformedNotification.readAt).toBe(originalNotification.readAt);
      expect(transformedNotification.deepLink).toBe(
        "/erogazione/richieste/test-entity"
      );
    });

    it("should handle multiple notifications with different types", () => {
      const notifications: inAppNotificationApi.Notifications = {
        totalCount: 4,
        results: [
          getMockNotification("agreementManagementToProducer", "agreement-123"),
          getMockNotification("eserviceStateChangedToConsumer", "eservice-456"),
          getMockNotification("unknownType", "entity-789"),
          getMockNotification(
            "purposeActivatedRejectedToConsumer",
            "purpose-101"
          ),
        ],
      };

      const result = toBffApiNotifications(notifications);

      expect(result.results[0].deepLink).toBe(
        "/erogazione/richieste/agreement-123"
      );
      expect(result.results[1].deepLink).toBe("/catalogo-e-service");
      expect(result.results[2].deepLink).toBe("/");
      expect(result.results[3].deepLink).toBe(
        "/fruizione/finalita/purpose-101"
      );
    });
  });
});
