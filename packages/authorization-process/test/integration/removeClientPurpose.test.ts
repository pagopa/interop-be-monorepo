/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockClient,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Client,
  ClientPurposeRemovedV2,
  PurposeId,
  generateId,
  toClientV2,
  ClientKind,
  TenantId,
} from "pagopa-interop-models";
import {
  clientNotFound,
  tenantNotAllowedOnClient,
  clientKindNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneClient,
  authorizationService,
  readLastAuthorizationEvent,
} from "../integrationUtils.js";

describe("remove client purpose", () => {
  it("should write on event-store for removing a purpose from a client", async () => {
    const mockConsumer = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();
    const purposeIdToNotRemove: PurposeId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove, purposeIdToNotRemove],
    };

    await addOneClient(mockClient);

    const removeClientPurposeResponse =
      await authorizationService.removeClientPurpose(
        {
          clientId: mockClient.id,
          purposeIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );

    const writtenEvent = await readLastAuthorizationEvent(mockClient.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockClient.id,
      version: "1",
      type: "ClientPurposeRemoved",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: ClientPurposeRemovedV2,
      payload: writtenEvent.data,
    });

    const expectedClient = {
      ...mockClient,
      purposes: [purposeIdToNotRemove],
    };
    expect(writtenPayload).toEqual({
      purposeId: purposeIdToRemove,
      client: toClientV2(expectedClient),
    });
    expect(removeClientPurposeResponse).toEqual({
      data: expectedClient,
      metadata: {
        version: 1,
      },
    });
  });
  it("should throw clientNotFound if the client doesn't exist", async () => {
    const mockConsumer = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();

    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer.id,
      purposes: [purposeIdToRemove],
    };

    await addOneClient(getMockClient());

    expect(
      authorizationService.removeClientPurpose(
        {
          clientId: mockClient.id,
          purposeIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      )
    ).rejects.toThrowError(clientNotFound(mockClient.id));
  });
  it("should throw tenantNotAllowedOnClient if the requester is not the consumer", async () => {
    const mockConsumer1 = getMockTenant();
    const mockConsumer2 = getMockTenant();
    const purposeIdToRemove: PurposeId = generateId();
    const mockClient: Client = {
      ...getMockClient(),
      consumerId: mockConsumer1.id,
      purposes: [purposeIdToRemove],
    };

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientPurpose(
        {
          clientId: mockClient.id,
          purposeIdToRemove,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer2.id) })
      )
    ).rejects.toThrowError(
      tenantNotAllowedOnClient(mockConsumer2.id, mockClient.id)
    );
  });
  it("should throw clientKindNotAllowed if the requester is the client api", async () => {
    const mockClient: Client = {
      ...getMockClient(),
      kind: ClientKind.Enum.Api,
    };

    const organizationId: TenantId = generateId();

    await addOneClient(mockClient);

    expect(
      authorizationService.removeClientPurpose(
        {
          clientId: mockClient.id,
          purposeIdToRemove: generateId(),
        },
        getMockContext({ authData: getMockAuthData(organizationId) })
      )
    ).rejects.toThrowError(clientKindNotAllowed(mockClient.id));
  });
});
