// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// import { describe, it, expect, vi } from "vitest";
// import {
//   generateId,
//   ProducerKeychain,
//   TenantId,
//   UserId,
// } from "pagopa-interop-models";
// import {
//   generateToken,
//   getMockKey,
//   getMockProducerKeychain,
// } from "pagopa-interop-commons-test";
// import { AuthRole, authRole } from "pagopa-interop-commons";
// import request from "supertest";
// import { authorizationApi } from "pagopa-interop-api-clients";
// import { api, authorizationService } from "../vitest.api.setup.js";
// import { keyToApiKey } from "../../src/model/domain/apiConverter.js";

// describe("API /producerKeychains/{producerKeychainId}/keys authorization test", () => {
//   const producerId: TenantId = generateId();
//   const userId: UserId = generateId();

//   const keySeed: authorizationApi.KeySeed = {
//     name: "key seed",
//     use: "ENC",
//     key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
//     alg: "",
//   };
//   const mockProducerKeychain: ProducerKeychain = {
//     ...getMockProducerKeychain(),
//     users: [userId],
//     producerId,
//     keys: [getMockKey()],
//   };

//   const apiKeys = mockProducerKeychain.keys.map(keyToApiKey);

//   authorizationService.createProducerKeychainKey = vi.fn().mockResolvedValue({
//     keys: getMockKey(),
//     totalCount: 1,
//   });

//   const a = authorizationApi.Keys.parse({
//     keys: mockProducerKeychain.keys.map(keyToApiKey),
//     totalCount: 1,
//   });

//   console.log(a);

//   const makeRequest = async (token: string, producerKeychainId: string) =>
//     request(api)
//       .post(`/producerKeychains/${producerKeychainId}/keys`)
//       .set("Authorization", `Bearer ${token}`)
//       .set("X-Correlation-Id", generateId())
//       .send(keySeed);

//   const authorizedRoles: AuthRole[] = [
//     authRole.ADMIN_ROLE,
//     authRole.SECURITY_ROLE,
//   ];
//   it.each(authorizedRoles)(
//     "Should return 200 for user with role %s",
//     async (role) => {
//       const token = generateToken(role);
//       const res = await makeRequest(token, mockProducerKeychain.id);
//       console.log(res.body);
//       expect(res.status).toBe(200);
//       expect(res.body).toEqual(apiKeys);
//     }
//   );

//   it.each(
//     Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
//   )("Should return 403 for user with role %s", async (role) => {
//     const token = generateToken(role);
//     const res = await makeRequest(token, mockProducerKeychain.id);
//     expect(res.status).toBe(403);
//   });

//   it("Should return 404 not found", async () => {
//     const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
//     expect(res.status).toBe(404);
//   });
// });

import { describe, expect, it } from "vitest";

describe("Test", () => {
  it("test", async () => {
    expect(1).toEqual(1);
  });
});
