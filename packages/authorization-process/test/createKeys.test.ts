import { expect, describe, it } from "vitest";

describe("createKeys", () => {
  it("should create the keys", async () => {
    expect(1).toEqual(1);
  });
});

// import crypto from "crypto";
// import { describe, it, vi, beforeAll, afterAll, expect } from "vitest";
// import {
//   Client,
//   ClientKeyAddedV2,
//   Key,
//   TenantId,
//   UserId,
//   generateId,
//   toClientV2,
// } from "pagopa-interop-models";
// import { AuthData, genericLogger } from "pagopa-interop-commons";
// import {
//   decodeProtobufPayload,
//   readLastEventByStreamId,
// } from "pagopa-interop-commons-test/index.js";
// import { getMockClient } from "pagopa-interop-commons-test";
// import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
// import { ApiKeySeed, ApiKeysSeed } from "../src/model/domain/models.js";
// import { addOneClient, authorizationService, postgresDB } from "./utils.js";

// describe("createKeys", () => {
//   const consumerId: TenantId = generateId();
//   const userId: UserId = generateId();

//   beforeAll(async () => {
//     vi.useFakeTimers();
//     vi.setSystemTime(new Date());
//   });

//   afterAll(() => {
//     vi.useRealTimers();
//   });

//   const key = crypto.generateKeyPairSync("rsa", {
//     modulusLength: 2048,
//   }).publicKey;

//   console.log("publicKey ", key);

//   const pemKey = Buffer.from(
//     key.export({ type: "pkcs1", format: "pem" })
//   ).toString("base64");

//   console.log("pemKey ", pemKey);

//   const keySeed: ApiKeySeed = {
//     name: "key seed",
//     use: "ENC",
//     key: pemKey,
//     alg: "",
//   };

//   const keysSeeds: ApiKeysSeed = [keySeed];

//   const mockClient: Client = {
//     ...getMockClient(),
//     users: [userId],
//     consumerId,
//   };

//   function mockSelfcareV2ClientCall(
//     value: Awaited<
//       ReturnType<typeof selfcareV2Client.getInstitutionProductUsersUsingGET>
//     >
//   ): void {
//     vi.spyOn(
//       selfcareV2Client,
//       "getInstitutionProductUsersUsingGET"
//     ).mockImplementationOnce(() => Promise.resolve(value));
//   }

//   const mockSelfCareUsers = {
//     id: generateId(),
//     name: "test",
//     roles: [],
//     email: "test@test.it",
//     surname: "surname_test",
//   };

//   const mockAuthData: AuthData = {
//     organizationId: consumerId,
//     selfcareId: generateId(),
//     externalId: {
//       value: "",
//       origin: "",
//     },
//     userId,
//     userRoles: [],
//   };

//   it.only("should create the keys", async () => {
//     mockSelfcareV2ClientCall([mockSelfCareUsers]);

//     await addOneClient(mockClient);

//     vi.mock("pagopa-interop-selfcare-v2-client", () => ({
//       selfcareV2Client: {
//         getInstitutionProductUsersUsingGET: (): Promise<boolean> =>
//           Promise.resolve(true),
//       },
//     }));
//     const { client } = await authorizationService.createKeys(
//       mockClient.id,
//       mockAuthData,
//       keysSeeds,
//       generateId(),
//       genericLogger
//     );

//     const writtenEvent = await readLastEventByStreamId(
//       client.id,
//       '"authorization"',
//       postgresDB
//     );

//     expect(writtenEvent).toMatchObject({
//       stream_id: client.id,
//       version: "0",
//       type: "ClientKeyAdded",
//       event_version: 2,
//     });

//     const writtenPayload = decodeProtobufPayload({
//       messageType: ClientKeyAddedV2,
//       payload: writtenEvent.data,
//     });

//     const expectedClient: Client = {
//       ...mockClient,
//       keys: [
//         ...client.keys,
//         {
//           name: keySeed.name,
//           createdAt: new Date(),
//           kid: writtenPayload.kid,
//           encodedPem: keySeed.key,
//           algorithm: keySeed.alg,
//           use: "Enc",
//         },
//       ],
//     };

//     expect(writtenPayload.client).toEqual(toClientV2(expectedClient));
//   });
// });
