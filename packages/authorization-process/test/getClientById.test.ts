import { genericLogger } from "pagopa-interop-commons";
import { Client, generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { clientNotFound } from "../src/model/domain/errors.js";
import { addOneClient, authorizationService, getMockClient } from "./utils.js";

describe("getClientById", async () => {
  it("should get from the readModel the client with the specified Id with users", async () => {
    const organizationId = generateId();
    const expectedClient: Client = {
      ...getMockClient(),
      consumerId: unsafeBrandId(organizationId),
    };
    await addOneClient(expectedClient);

    const { client } = await authorizationService.getClientById(
      expectedClient.id,
      unsafeBrandId(organizationId),
      genericLogger
    );
    expect(client).toEqual(expectedClient);
  });
  it("should get from the readModel the client with the secified Id without users", async () => {
    const mockClient = getMockClient();

    await addOneClient(mockClient);

    const { client } = await authorizationService.getClientById(
      mockClient.id,
      generateId(),
      genericLogger
    );
    expect(client).toEqual(mockClient);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    const clientId = generateId();
    await expect(
      authorizationService.getClientById(
        unsafeBrandId(clientId),
        generateId(),
        genericLogger
      )
    ).rejects.toThrowError(clientNotFound(unsafeBrandId(clientId)));
  });
});
