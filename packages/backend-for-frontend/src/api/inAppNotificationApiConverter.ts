import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { bffApi } from "pagopa-interop-api-clients";
import { uiSectionToNotificationTypes } from "../model/modelMappingUtils.js";

function findNotificationSection(
  notificationType: string
): { section: string; subsection?: string } | null {
  for (const [section, sectionData] of Object.entries(
    uiSectionToNotificationTypes
  )) {
    if (Array.isArray(sectionData)) {
      if (sectionData.includes(notificationType)) {
        return { section };
      }
    } else {
      for (const [subsection, notificationTypes] of Object.entries(
        sectionData
      )) {
        if (notificationTypes.includes(notificationType)) {
          return { section, subsection };
        }
      }
    }
  }
  return null;
}

function calculateDeepLink(
  notification: inAppNotificationApi.Notification
): string {
  const { notificationType, entityId } = notification;

  const sectionInfo = findNotificationSection(notificationType);
  if (!sectionInfo) {
    return "/";
  }

  const { section, subsection } = sectionInfo;

  if (!subsection) {
    return `/${section}`;
  }

  return `/${section}/${subsection}/${entityId}`;
}

function sumNotificationTypesCount(
  results: Record<string, number>,
  notificationTypes: ReadonlyArray<string>
): number {
  return notificationTypes.reduce((sum, type) => sum + (results[type] || 0), 0);
}

export function toBffApiNotificationsCountBySection(
  notificationsCountBySection: inAppNotificationApi.NotificationsByType
): bffApi.NotificationsCountBySection {
  const results = notificationsCountBySection.results || {};

  const erogazioneRichieste = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.erogazione.richieste
  );
  const erogazioneFinalita = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.erogazione.finalita
  );
  const erogazioneTemplateEservice = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.erogazione["template-eservice"]
  );
  const erogazioneEservice = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.erogazione["e-service"]
  );
  const erogazionePortachiavi = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.erogazione.portachiavi
  );

  const fruizioneRichieste = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.fruizione.richieste
  );
  const fruizioneFinalita = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.fruizione.finalita
  );

  const catalogoEserviceCount = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes["catalogo-e-service"]
  );

  const aderenteDeleghe = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.aderente.deleghe
  );
  const aderenteAnagrafica = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes.aderente.anagrafica
  );

  const gestioneClientApiEservice = sumNotificationTypesCount(
    results,
    uiSectionToNotificationTypes["gestione-client"]["api-e-service"]
  );

  const erogazioneTotalCount =
    erogazioneRichieste +
    erogazioneFinalita +
    erogazioneTemplateEservice +
    erogazioneEservice +
    erogazionePortachiavi;

  const fruizioneTotalCount = fruizioneRichieste + fruizioneFinalita;

  const aderenteTotalCount = aderenteDeleghe + aderenteAnagrafica;

  return {
    erogazione: {
      richieste: erogazioneRichieste,
      finalita: erogazioneFinalita,
      "template-eservice": erogazioneTemplateEservice,
      "e-service": erogazioneEservice,
      portachiavi: erogazionePortachiavi,

      totalCount: erogazioneTotalCount,
    },
    fruizione: {
      richieste: fruizioneRichieste,
      finalita: fruizioneFinalita,

      totalCount: fruizioneTotalCount,
    },
    "catalogo-e-service": {
      totalCount: catalogoEserviceCount,
    },
    aderente: {
      deleghe: aderenteDeleghe,
      anagrafica: aderenteAnagrafica,

      totalCount: aderenteTotalCount,
    },
    "gestione-client": {
      "api-e-service": gestioneClientApiEservice,

      totalCount: gestioneClientApiEservice,
    },
    totalCount: notificationsCountBySection.totalCount,
  };
}

export function toBffApiNotifications(
  notifications: inAppNotificationApi.Notifications
): bffApi.Notifications {
  return {
    totalCount: notifications.totalCount,
    results: notifications.results.map((notification) => ({
      id: notification.id,
      tenantId: notification.tenantId,
      userId: notification.userId,
      body: notification.body,
      deepLink: calculateDeepLink(notification),
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    })),
  };
}
