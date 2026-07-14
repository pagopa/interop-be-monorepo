import {
  CorrelationId,
  EmailNotificationMessagePayload,
  NotificationType,
} from "pagopa-interop-models";
import {
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import {
  ScheduledNotificationRow,
  parseEServiceEntityId,
} from "pagopa-interop-scheduled-notification-db-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

const PRODUCER_NOTIFICATION: NotificationType =
  "eserviceStateChangedToProducer";

type EmailReminderHandlerDeps = {
  readModelService: ReadModelServiceSQL;
  templateService: HtmlTemplateService;
  bffUrl: string;
  correlationId: CorrelationId;
  log: Logger;
};

export async function handleEserviceArchivingScheduledReminderEmail(
  row: ScheduledNotificationRow,
  deps: EmailReminderHandlerDeps
): Promise<EmailNotificationMessagePayload[]> {
  const { readModelService, templateService, bffUrl, correlationId, log } =
    deps;

  const eserviceId = parseEServiceEntityId(row.entityId);
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    log.warn(
      `Skipping scheduled email reminder: eservice ${eserviceId} not found (row ${row.id})`
    );
    return [];
  }
  const targets = eservice.descriptors.filter(
    (d) => d.archivingSchedule?.scope === "EService"
  );
  if (targets.length === 0) {
    log.warn(
      `Skipping scheduled email reminder: eservice ${eserviceId} has no descriptors with archivingSchedule.scope === "EService" (row ${row.id})`
    );
    return [];
  }
  const archivableOns = targets
    .map((d) => d.archivingSchedule?.archivableOn)
    .filter((d): d is Date => d !== undefined);
  if (archivableOns.length === 0) {
    log.warn(
      `Skipping scheduled email reminder: eservice ${eserviceId} has eservice-scope descriptors with no archivableOn (row ${row.id})`
    );
    return [];
  }
  const archivableOn = new Date(
    Math.min(...archivableOns.map((d) => d.getTime()))
  );
  const archivableOnFormatted = dateAtRomeZone(archivableOn);
  const entityId = eservice.id;

  const [producerTemplate, producerTenant] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceStateChangedToProducerScheduledReminderEserviceMailTemplate
    ),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  const producerTargets = await getRecipientsForTenants({
    tenants: [producerTenant],
    notificationType: PRODUCER_NOTIFICATION,
    readModelService,
    logger: log,
    includeTenantContactEmails: false,
  });
  const producerSubject = `Promemoria: archiviazione dell'e-service "${eservice.name}"`;
  const producerPayloads = producerTargets.map((t) => ({
    correlationId,
    email: {
      subject: producerSubject,
      body: templateService.compileHtml(producerTemplate, {
        title: producerSubject,
        notificationType: PRODUCER_NOTIFICATION,
        entityId,
        ...(t.type === "Tenant" ? { recipientName: producerTenant.name } : {}),
        eserviceName: eservice.name,
        archivableOn: archivableOnFormatted,
        ctaLabel: "Visualizza e-service",
        selfcareId: t.selfcareId,
        bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));

  return producerPayloads;
}
