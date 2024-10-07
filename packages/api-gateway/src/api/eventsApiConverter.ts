import { apiGatewayApi, notifierApi } from "pagopa-interop-api-clients";

export function notifierEventsToApiGatewayEvents(
  events: notifierApi.Events
): apiGatewayApi.Events {
  return {
    events: events.events.map(
      ({ eventId, eventType, objectType, objectId }) => ({
        eventId,
        eventType,
        objectType,
        objectId,
      })
    ),
  };
}
