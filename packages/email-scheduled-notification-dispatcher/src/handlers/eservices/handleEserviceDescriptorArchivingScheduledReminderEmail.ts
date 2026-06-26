import { differenceInCalendarDays } from "date-fns";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  NotificationType,
  TenantId,
} from "pagopa-interop-models";
import {
  HtmlTemplateService,
  Logger,
  dateAtRomeZone,
} from "pagopa-interop-commons";
import {
  eventMailTemplateType,
  formatDaysRemaining,
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
const CONSUMER_NOTIFICATION: NotificationType =
  "eserviceStateChangedToConsumer";

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
  const daysRemaining = Math.max(
    differenceInCalendarDays(archivableOn, new Date()),
    0
  );
  const archivableOnFormatted = dateAtRomeZone(archivableOn);
  const daysRemainingText = formatDaysRemaining(daysRemaining);
  const entityId = `${eservice.id}/${descriptor.id}`;

  const [producerTemplate, consumerTemplate, producerTenant] =
    await Promise.all([
      retrieveHTMLTemplate(
        eventMailTemplateType.eserviceStateChangedToProducerScheduledReminderDescriptorMailTemplate
      ),
      retrieveHTMLTemplate(
        eventMailTemplateType.eserviceStateChangedToConsumerScheduledReminderDescriptorMailTemplate
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
        daysRemaining,
        daysRemainingText,
        archivableOn: archivableOnFormatted,
        ctaLabel: "Accedi a PDND",
        selfcareId: t.selfcareId,
        bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));

  const agreements = await readModelService.getAgreementsByEserviceId(
    eservice.id,
    { includeArchived: false }
  );
  const consumerIds = Array.from(
    new Set(
      agreements
        .filter((a) => a.descriptorId === descriptor.id)
        .map((a) => a.consumerId)
    )
  ) as TenantId[];

  let consumerPayloads: EmailNotificationMessagePayload[] = [];
  if (consumerIds.length > 0) {
    const consumerTenants = await readModelService.getTenantsByIds(consumerIds);
    if (consumerTenants.length < consumerIds.length) {
      const missing = consumerIds.filter(
        (id) => !consumerTenants.some((t) => t.id === id)
      );
      log.warn(
        `Skipping ${missing.length} missing consumer tenants for descriptor ${descriptor.id} of eservice ${eservice.id} (row ${row.id}): ${missing.join(", ")}`
      );
    }
    const consumerTargets = await getRecipientsForTenants({
      tenants: consumerTenants,
      notificationType: CONSUMER_NOTIFICATION,
      readModelService,
      logger: log,
      includeTenantContactEmails: false,
    });
    const consumerSubject = `Promemoria: archiviazione dell'e-service "${eservice.name}" a cui sei iscritto`;
    consumerPayloads = consumerTargets.map((t) => {
      const consumerTenant = consumerTenants.find((tt) => tt.id === t.tenantId);
      return {
        correlationId,
        email: {
          subject: consumerSubject,
          body: templateService.compileHtml(consumerTemplate, {
            title: consumerSubject,
            notificationType: CONSUMER_NOTIFICATION,
            entityId,
            ...(t.type === "Tenant" && consumerTenant
              ? { recipientName: consumerTenant.name }
              : {}),
            eserviceName: eservice.name,
            eserviceVersion: descriptor.version,
            producerName: producerTenant.name,
            daysRemaining,
            daysRemainingText,
            archivableOn: archivableOnFormatted,
            ctaLabel: "Accedi a PDND",
            selfcareId: t.selfcareId,
            bffUrl,
          }),
        },
        tenantId: t.tenantId,
        ...mapRecipientToEmailPayload(t),
      };
    });
  }

  return [...producerPayloads, ...consumerPayloads];
}
