import { getMockClient } from "pagopa-interop-commons-test/src/testUtils.js";
import { Client, Key, generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../src/model/domain/errors.js";
import { addOneClient, authorizationService } from "./utils.js";

describe("getClientKeys", async () => {
  const consumerId = generateId();
  const userIds1 = generateId();
  const userIds2 = generateId();
  const mockKey: Key = {
    name: "Key 1",
    createdAt: new Date(),
    kid: "",
    encodedPem: "",
    algorithm: "",
    use: "Sig",
  };
  const mockClient: Client = {
    ...getMockClient(),
    keys: [mockKey],
    users: [unsafeBrandId(userIds1), unsafeBrandId(userIds2)],
    consumerId: unsafeBrandId(consumerId),
  };

  it("should get from the readModel the keys in the specified client", async () => {
    await addOneClient(mockClient);

    const { keys } = await authorizationService.getClientKeys(
      mockClient.id,
      unsafeBrandId(consumerId),
      genericLogger
    );
    expect(keys).toEqual([mockKey]);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    await addOneClient(getMockClient());
    const clientId = generateId();
    await expect(
      authorizationService.getClientKeys(
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
      authorizationService.getClientKeys(
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
