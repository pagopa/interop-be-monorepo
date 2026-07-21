import {
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import {
  ScheduledNotificationRow,
  parseEServiceIdDescriptorId,
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

export async function handleEserviceDescriptorArchivingScheduledReminderEmail(
  row: ScheduledNotificationRow,
  deps: EmailReminderHandlerDeps
): Promise<EmailNotificationMessagePayload[]> {
  const { readModelService, templateService, bffUrl, correlationId, log } =
    deps;

  const { eserviceId, descriptorId } = parseEServiceIdDescriptorId(
    row.entityId
  );
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    log.warn(
      `Skipping scheduled email reminder: eservice ${eserviceId} not found (row ${row.id})`
    );
    return [];
  }
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    log.warn(
      `Skipping scheduled email reminder: descriptor ${descriptorId} not found in eservice ${eserviceId} (row ${row.id})`
    );
    return [];
  }
  if (!descriptor.archivingSchedule) {
    log.warn(
      `Skipping scheduled email reminder: descriptor ${descriptorId} has no archivingSchedule (row ${row.id})`
    );
    return [];
  }
  if (descriptor.archivingSchedule.scope !== "Descriptor") {
    log.warn(
      `Skipping scheduled email reminder: descriptor ${descriptorId} has archivingSchedule.scope="${descriptor.archivingSchedule.scope}", expected "Descriptor" (row ${row.id})`
    );
    return [];
  }

  const archivableOn = descriptor.archivingSchedule.archivableOn;
  const archivableOnFormatted = dateAtRomeZone(archivableOn);
  const entityId = `${eservice.id}/${descriptor.id}`;

  const [producerTemplate, producerTenant] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceStateChangedToProducerScheduledReminderDescriptorMailTemplate
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
        eserviceVersion: descriptor.version,
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
