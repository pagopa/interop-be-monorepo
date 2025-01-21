import { CreateEvent } from "pagopa-interop-commons";
import {
  EServiceTemplateEvent,
  toEServiceTemplateV2,
  CorrelationId,
  EServiceTemplate,
} from "pagopa-interop-models";

export const toCreateEventEServiceTemplateAdded = (
  eservice: EServiceTemplate,
  correlationId: CorrelationId
): CreateEvent<EServiceTemplateEvent> => ({
  streamId: eservice.id,
  version: 0,
  event: {
    type: "EServiceTemplateAdded",
    event_version: 2,
    data: { eserviceTemplate: toEServiceTemplateV2(eservice) },
  },
  correlationId,
});
