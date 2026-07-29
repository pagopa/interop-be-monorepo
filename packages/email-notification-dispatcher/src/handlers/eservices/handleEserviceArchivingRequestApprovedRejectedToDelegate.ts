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
  "eserviceArchivingRequestApprovedRejectedToDelegate";

type EServiceArchivingRequestApprovedRejectedToDelegateEventType =
  | "EServiceArchivingRequestApprovedByDelegator"
  | "EServiceArchivingRequestRejectedByDelegator"
  | "EServiceDescriptorArchivingRequestApprovedByDelegator"
  | "EServiceDescriptorArchivingRequestRejectedByDelegator";

type EServiceArchivingRequestApprovedRejectedToDelegateEvent = Extract<
  EServiceEventV2,
  { type: EServiceArchivingRequestApprovedRejectedToDelegateEventType }
>;

type EServiceArchivingRequestApprovedRejectedToDelegateParams =
  HandlerCommonParams & {
    decodedMessage: EServiceArchivingRequestApprovedRejectedToDelegateEvent;
  };

export async function handleEserviceArchivingRequestApprovedRejectedToDelegate(
  params: EServiceArchivingRequestApprovedRejectedToDelegateParams
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
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceStateChangedMailTemplate
    ),
    retrieveProducerDelegation(eservice, readModelService),
  ]);

  const [delegator, delegate] = await Promise.all([
    retrieveTenant(delegation.delegatorId, readModelService),
    retrieveTenant(delegation.delegateId, readModelService),
  ]);

  const { subject, copy, descriptorId } = match(decodedMessage)
    .with(
      { type: "EServiceDescriptorArchivingRequestApprovedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        const archivableOn = descriptor.archivingSchedule?.archivableOn;

        return {
          subject:
            "La tua richiesta di archiviazione della versione dell' e-service è stata confermata",
          copy: `${delegator.name} ha approvato la tua richiesta di archiviazione della versione ${descriptor.version} dell'e-service ${eservice.name}.${
            archivableOn
              ? ` L'archiviazione avverrà il giorno ${dateAtRomeZone(archivableOn)}.`
              : ""
          }`,
          descriptorId,
        };
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingRequestRejectedByDelegator" },
      ({ data: { descriptorId } }) => {
        const descriptor = retrieveDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );

        return {
          subject:
            "La tua richiesta di archiviazione della versione dell' e-service è stata rifiutata",
          copy: `${delegator.name} ha rifiutato la tua richiesta di archiviazione della versione ${descriptor.version} dell'e-service ${eservice.name}.`,
          descriptorId,
        };
      }
    )
    .with({ type: "EServiceArchivingRequestApprovedByDelegator" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);
      const archivableOn = descriptor.archivingSchedule?.archivableOn;

      return {
        subject:
          "La tua richiesta di archiviazione di un e-service è stata confermata",
        copy: `${delegator.name} ha approvato la tua richiesta di archiviazione dell'e-service ${eservice.name}.${
          archivableOn
            ? ` L'archiviazione avverrà il giorno ${dateAtRomeZone(archivableOn)}.`
            : ""
        }`,
        descriptorId: descriptor.id,
      };
    })
    .with({ type: "EServiceArchivingRequestRejectedByDelegator" }, () => {
      const descriptor = retrieveLatestDescriptor(eservice);

      return {
        subject:
          "La tua richiesta di archiviazione di un e-service è stata rifiutata",
        copy: `${delegator.name} ha rifiutato la tua richiesta di archiviazione dell'e-service ${eservice.name}.`,
        descriptorId: descriptor.id,
      };
    })
    .exhaustive();

  const targets = await getRecipientsForTenants({
    tenants: [delegate],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handleEserviceArchivingRequestApprovedRejectedToDelegate - entityId: ${eservice.id}, eventType: ${decodedMessage.type}`
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
        ...(t.type === "Tenant" ? { recipientName: delegate.name } : {}),
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
