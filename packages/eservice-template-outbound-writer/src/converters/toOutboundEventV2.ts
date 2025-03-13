import { EServiceTemplateV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundEServiceTemplateV2(
  template: EServiceTemplateV2
): Exact<OutboundEServiceTemplateV2, EServiceTemplateV2> {
  return {
    ...template,
  };
}

export function toOutboundEventV2(
  message: EServiceTemplateEventEnvelopeV2
): OutboundEServiceTemplateEvent | undefined {
  return match(message)
    .returnType<OutboundEServiceTemplateEvent | undefined>()
    .with(
      { type: "ProducerDelegationSubmitted" },
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationApproved" },
      { type: "ConsumerDelegationRejected" },
      { type: "ConsumerDelegationRevoked" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          delegation:
            msg.data.delegation &&
            toOutboundEServiceTemplateV2(msg.data.delegation),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .exhaustive();
}
