/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import { inAppNotificationApi, bffApi } from "pagopa-interop-api-clients";
import { toBffApiNotificationsCountBySection } from "../../src/api/inAppNotificationApiConverter.js";

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
    const input: inAppNotificationApi.NotificationsByType = {
      results: {},
      totalCount: 0,
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
