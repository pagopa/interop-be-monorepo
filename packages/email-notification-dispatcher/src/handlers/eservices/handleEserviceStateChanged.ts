import {
  Descriptor,
  DescriptorId,
  EmailNotificationMessagePayload,
  EService,
  EServiceEventV2,
  EServiceIdDescriptorId,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Tenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { getRecipientsForTenants } from "../handlerCommons.js";
import { HandlerCommonParams } from "../../models/handlerParams.js";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import { descriptorNotFound } from "../../models/errors.js";

/* These events have been grouped under
 * a single handler because of their shared
 * nature and to avoid excessive bloating. */

type EServiceStateChangedEventType =
  | "EServiceNameUpdated"
  | "EServiceDescriptionUpdated"
  | "EServiceNameUpdatedByTemplateUpdate"
  | "EServiceDescriptorQuotasUpdated"
  | "EServiceDescriptorQuotasUpdatedByTemplateUpdate"
  | "EServiceDescriptorDocumentAdded"
  | "EServiceDescriptorDocumentUpdated"
  | "EServiceDescriptorDocumentAddedByTemplateUpdate"
  | "EServiceDescriptorDocumentUpdatedByTemplateUpdate";

type EServiceStateChangedEvent = Extract<
  EServiceEventV2,
  { type: EServiceStateChangedEventType }
>;

export type EServiceUpdatedHandlerParams = HandlerCommonParams & {
  payload: EServiceStateChangedEvent;
};

const notificationType: NotificationType = "eserviceStateChangedToConsumer";

export async function handleEserviceStateChanged(
  params: EServiceUpdatedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = params;

  const eserviceV2Msg = params.payload.data.eservice;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError("eservice", "EServiceNameUpdated");
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, agreements, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceStateChangedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  if (!agreements || agreements.length === 0) {
    return [];
  }

  const consumers = await readModelService.getTenantsById(
    agreements.map((agreement) => agreement.consumerId)
  );

  const targets = await getRecipientsForTenants({
    tenants: consumers,
    notificationType,
    readModelService,
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  const {
    copy,
    descriptorId: descriptorIdFromEvent,
    title: defaultTitle,
  } = getCopyAndDescriptorId(params.payload, eservice, producer);

  const descriptorId = descriptorIdFromEvent
    ? unsafeBrandId<DescriptorId>(descriptorIdFromEvent)
    : retrieveLatestPublishedDescriptor(eservice).id;

  const title = defaultTitle ?? `Modifiche alla versione di "${eservice.name}"`;

  const entityId = EServiceIdDescriptorId.parse(
    `${eservice.id}/${descriptorId}`
  );

  return targets.flatMap(({ address, tenantId }) => {
    const tenant = consumers.find((tenant) => tenant.id === tenantId);

    if (!tenant) {
      return [];
    }

    return [
      {
        correlationId: correlationId ?? generateId(),
        email: {
          subject: title,
          body: templateService.compileHtml(htmlTemplate, {
            title,
            notificationType,
            entityId,
            consumerName: tenant.name,
            copy,
            ctaLabel: `Visualizza e-service`,
          }),
        },
        address,
      },
    ];
  });
}

function getCopyAndDescriptorId(
  payload: EServiceStateChangedEvent,
  eservice: EService,
  producer: Tenant
): { copy: string; descriptorId?: string; title?: string } {
  return match(payload)
    .with(
      {
        type: P.union(
          "EServiceNameUpdated",
          "EServiceNameUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { oldName } }) => ({
        copy: `Ti informiamo che l'e-service "${oldName}" è stato rinominato in "${eservice.name}" dall'ente erogatore. La tua richiesta di fruizione rimane attiva e non sono richieste azioni da parte tua.`,
        title: `L'e-service "${oldName}" è stato rinominato`,
      })
    )
    .with(
      {
        type: "EServiceDescriptionUpdated",
      },
      () => {
        const descriptor = retrieveLatestPublishedDescriptor(eservice);
        return {
          copy: `L'ente erogatore ${producer.name} ha modificato la descrizione nella versione ${descriptor.version} dell'e-service "${eservice.name}" a cui sei iscritto. Ti invitiamo a prendere visione della documentazione integrativa.`,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId } }) => {
        const descriptor = getDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          copy: `L'ente erogatore ${producer.name} ha apportato delle modifiche alle soglie di carico nella versione ${descriptor.version} dell'e-service "${eservice.name}" a cui sei iscritto. Ti invitiamo a prendere visione delle variazioni per assicurarti che non impattino la tua operatività.`,
          descriptorId,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentAddedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId } }) => {
        const descriptor = getDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          copy: `L'ente erogatore <Nome Ente Erogatore> ha aggiunto un documento nella versione ${descriptor.version} dell'e-service "${eservice.name}" a cui sei iscritto. Ti invitiamo a prendere visione della documentazione integrativa.`,
          descriptorId,
        };
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      ({ data: { descriptorId } }) => {
        const descriptor = getDescriptor(
          eservice,
          unsafeBrandId<DescriptorId>(descriptorId)
        );
        return {
          copy: `L'ente erogatore ${producer.name} ha aggiornato un documento nella versione ${descriptor.version} dell'e-service "${eservice.name}" a cui sei iscritto. Ti invitiamo a prendere visione della documentazione integrativa.`,
          descriptorId,
        };
      }
    )
    .exhaustive();
}

function getDescriptor(
  eservice: EService,
  descriptorId: DescriptorId
): Descriptor {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }
  return descriptor;
}
