import { dateAtRomeZone } from "pagopa-interop-commons";
import {
  EmailNotificationMessagePayload,
  EServiceEventV2,
  NotificationType,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  DescriptorId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveDescriptor,
  retrieveHTMLTemplate,
  retrieveLatestDescriptor,
  retrieveProducerDelegation,
  retrieveTenant,
} from "pagopa-interop-notification-commons";
import { match } from "ts-pattern";

import { config } from "../../config/config.js";
import { HandlerCommonParams } from "../../models/handlerParams.js";

const notificationType: NotificationType =
  "eserviceArchivingRequestSubmittedToDelegator";

type EServiceArchivingRequestSubmittedToDelegatorEventType =
  | "EServiceArchivingRequestedByDelegate"
  | "EServiceDescriptorArchivingRequestedByDelegate";

type EServiceArchivingRequestSubmittedToDelegatorEvent = Extract<
  EServiceEventV2,
  { type: EServiceArchivingRequestSubmittedToDelegatorEventType }
>;

type EServiceArchivingRequestSubmittedToDelegatorParams = HandlerCommonParams & {
  decodedMessage: EServiceArchivingRequestSubmittedToDelegatorEvent;
};

export async function handleEserviceArchivingRequestSubmittedToDelegator(
  params: EServiceArchivingRequestSubmittedToDelegatorParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = params;

  if (!decodedMessage.data.eservice) {
    throw missingKafkaMessageDataError("eservice", decodedMessage.type);
  }

  const eservice = fromEServiceV2(decodedMessage.data.eservice);
  const [htmlTemplate, delegation] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.eserviceStateChangedMailTemplate),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [delegator, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const { subject, copy, descriptorId } = match(decodedMessage)
    .with(
      { type: "EServiceDescriptorArchivingRequestedByDelegate" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        const archivableOn = descriptor.archivingSchedule?.archivableOn;

        return {
          subject:
            "Nuova richiesta di archiviazione di una versione di un e-service",
          copy: `${delegate.name} ha richiesto l'archiviazione della versione ${descriptor.version} dell'e-service ${eservice.name}. Puoi approvare o rifiutare la richiesta.${
            archivableOn
              ? ` Se confermi la richiesta, l'e-service sarà archiviato definitivamente e rimosso dal catalogo il giorno ${dateAtRomeZone(archivableOn)}. Entro questa data, potrai annullare l'archiviazione.`
              : ""
          }`,
          descriptorId,
        };
      }
    )
    .with({ type: "EServiceArchivingRequestedByDelegate" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      const archivableOn = descriptor.archivingSchedule?.archivableOn;

      return {
        subject: "Nuova richiesta di archiviazione di un e-service",
        copy: `${delegate.name} ha richiesto l'archiviazione dell'e-service ${eservice.name}. Puoi approvare o rifiutare la richiesta.${
          archivableOn
            ? ` Se confermi la richiesta, l'e-service sarà archiviato definitivamente e rimosso dal catalogo il giorno ${dateAtRomeZone(archivableOn)}. Entro questa data, potrai annullare l'archiviazione.`
            : ""
        }`,
        descriptorId: descriptor.id,
      };
    })
    .exhaustive();

  const targets = await getRecipientsForTenants({
    tenants: [delegator],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEserviceArchivingRequestSubmittedToDelegator - entityId: ${eservice.id}, eventType: ${decodedMessage.type}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject,
      body: templateService.compileHtml(htmlTemplate, {
        title: subject,
        notificationType,
        entityId: `${eservice.id}/${descriptorId}`,
        ...(t.type === "Tenant" ? { recipientName: delegator.name } : {}),
        copy,
        ctaLabel: "Accedi a PDND",
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
