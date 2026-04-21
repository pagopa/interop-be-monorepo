import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  authorizationApi,
  m2mEventApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import {
  getMockedApiConsumerFullClient,
  getMockedApiConsumerPartialClient,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenNthCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getKeyEvents integration", () => {
  const requesterId = generateId<TenantId>();
  const events: m2mEventApi.KeyM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "CLIENT_KEY_ADDED",
      clientId: generateId(),
      kid: generateId(),
    },
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "CLIENT_KEY_DELETED",
      clientId: generateId(),
      kid: generateId(),
    },
  ];

  const fullClientResponse: WithMaybeMetadata<authorizationApi.FullClient> = {
    data: {
      ...getMockedApiConsumerFullClient(),
      id: events[0].clientId,
      consumerId: requesterId,
    },
    metadata: undefined,
  };
  const partialClientResponse: WithMaybeMetadata<authorizationApi.PartialClient> =
    {
      data: {
        ...getMockedApiConsumerPartialClient(),
        id: events[1].clientId,
      },
      metadata: undefined,
    };

  const mockEventManagerResponse: m2mEventApi.KeyM2MEvents = {
    events,
  };
  const mockGetKeyM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);
  const mockGetClient = vi
    .fn()
    .mockImplementation(({ params }) =>
      Promise.resolve(
        params.clientId === events[0].clientId
          ? fullClientResponse
          : partialClientResponse
      )
    );

  mockInteropBeClients.eventManagerClient = {
    getKeyM2MEvents: mockGetKeyM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];
  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetKeyM2MEvents.mockClear();
    mockGetClient.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should only return key events owned by the requester",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.KeyEvents = {
        events: [events[0]],
      };
      const result = await eventService.getKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext({ organizationId: requesterId })
      );
      expect(result).toStrictEqual(expectedResponse);
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: 1,
        mockGet: mockGetClient,
        params: {
          clientId: events[0].clientId,
        },
      });
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: 2,
        mockGet: mockGetClient,
        params: {
          clientId: events[1].clientId,
        },
      });
    }
  );
});
