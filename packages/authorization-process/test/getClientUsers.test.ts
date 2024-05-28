import { getMockClient } from "pagopa-interop-commons-test/src/testUtils.js";
import { Client, generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientUsers", async () => {
  const consumerId = generateId();
  const userIds1 = generateId();
  const userIds2 = generateId();
  const mockClient: Client = {
    ...getMockClient(),
    users: [unsafeBrandId(userIds1), unsafeBrandId(userIds2)],
    consumerId: unsafeBrandId(consumerId),
  };

  it("should get from the readModel the users in the specified client", async () => {
    await addOneClient(mockClient);

    const { users } = await authorizationService.getClientUsers(
      mockClient.id,
      unsafeBrandId(consumerId),
      genericLogger
    );
    expect(users).toEqual([userIds1, userIds2]);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(getMockClient());
    const clientId = generateId();
    await expect(
      authorizationService.getClientUsers(
        unsafeBrandId(clientId),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(unsafeBrandId(clientId)));
  });
  it("should throw organizationNotAllowedOnClient if the requester is not the consumer", async () => {
    await addOneClient(mockClient);
    const organizationId = generateId();
    await expect(
      authorizationService.getClientUsers(
        mockClient.id,
        unsafeBrandId(organizationId),
        genericLogger
      )
    ).rejects.toThrowError(
      organizationNotAllowedOnClient(
        unsafeBrandId(organizationId),
        unsafeBrandId(mockClient.id)
      )
    );
  });
});
