import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  authorizationApi,
  m2mGatewayApi,
  m2mEventApi,
} from "pagopa-interop-api-clients";
import {
  getMockedApiFullProducerKeychain,
  getMockedApiPartialProducerKeychain,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getProducerKeyEvents integration", () => {
  const requesterId = generateId<TenantId>();
  const events: m2mEventApi.ProducerKeyM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PRODUCER_KEYCHAIN_KEY_ADDED",
      producerKeychainId: generateId(),
      kid: generateId(),
    },
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PRODUCER_KEYCHAIN_KEY_DELETED",
      producerKeychainId: generateId(),
      kid: generateId(),
    },
  ];

  const fullProducerKeychainResponse: WithMaybeMetadata<authorizationApi.FullProducerKeychain> =
    {
      data: {
        ...getMockedApiFullProducerKeychain(),
        id: events[0].producerKeychainId,
        producerId: requesterId,
      },
      metadata: undefined,
    };
  const partialProducerKeychainResponse: WithMaybeMetadata<authorizationApi.PartialProducerKeychain> =
    {
      data: {
        ...getMockedApiPartialProducerKeychain(),
        id: events[1].producerKeychainId,
      },
      metadata: undefined,
    };

  const mockEventManagerResponse: m2mEventApi.ProducerKeyM2MEvents = {
    events,
  };

  const mockGetProducerKeyM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);
  const mockGetProducerKeychain = vi
    .fn()
    .mockImplementation(({ params }) =>
      Promise.resolve(
        params.producerKeychainId === events[0].producerKeychainId
          ? fullProducerKeychainResponse
          : partialProducerKeychainResponse
      )
    );

  mockInteropBeClients.eventManagerClient = {
    getProducerKeyM2MEvents: mockGetProducerKeyM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];
  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetProducerKeyM2MEvents.mockClear();
    mockGetProducerKeychain.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should only return producer key events owned by the requester",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.ProducerKeyEvents = {
        events: [events[0]],
      };
      const result = await eventService.getProducerKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext({ organizationId: requesterId })
      );
      expect(result).toStrictEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetProducerKeyM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: 1,
        mockGet: mockGetProducerKeychain,
        params: {
          producerKeychainId: events[0].producerKeychainId,
        },
      });
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: 2,
        mockGet: mockGetProducerKeychain,
        params: {
          producerKeychainId: events[1].producerKeychainId,
        },
      });
    }
  );
});
