import { genericLogger } from "pagopa-interop-commons";
import { Client, generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { clientNotFound } from "../src/model/domain/errors.js";
import { addOneClient, authorizationService, getMockClient } from "./utils.js";

describe("getClientById", async () => {
  it("should get from the readModel the client with the secified Id with users", async () => {
    const organizationId = generateId();
    const client: Client = {
      ...getMockClient(),
      consumerId: unsafeBrandId(organizationId),
    };
    await addOneClient(client);

    const result = await authorizationService.getClientById(
      client.id,
      unsafeBrandId(organizationId),
      genericLogger
    );
    expect(result).toMatchObject(client);
  });
  it("should get from the readModel the client with the secified Id without users", async () => {
    const client = getMockClient();

    await addOneClient(client);

    const result = await authorizationService.getClientById(
      client.id,
      generateId(),
      genericLogger
    );
    expect(result).toMatchObject(client);
  });
  it("should throw clientNotFound if the client with the specified Id doesn't exist", async () => {
    const client = getMockClient();
    await expect(
      authorizationService.getClientById(client.id, generateId(), genericLogger)
    ).rejects.toThrowError(clientNotFound(client.id));
  });
});
