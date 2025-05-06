// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// import { describe, it, expect, vi } from "vitest";
// import { generateId, TenantId } from "pagopa-interop-models";
// import { generateToken, getMockKey } from "pagopa-interop-commons-test";
// import { AuthRole, authRole } from "pagopa-interop-commons";
// import request from "supertest";
// import { authorizationApi } from "pagopa-interop-api-clients";
// import { api, authorizationService } from "../vitest.api.setup.js";
// import { keyToApiKey } from "../../src/model/domain/apiConverter.js";

// describe("API /producerKeychains/:producerKeychainId/keys authorization test", () => {
//   const producerKeychainId: TenantId = generateId();

//   const keySeed: authorizationApi.KeySeed = {
//     name: "key seed",
//     use: "ENC",
//     key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
//     alg: "",
//   };

//   const mockKeys = [getMockKey()];
//   const apiKeys: authorizationApi.Keys = {
//     keys: mockKeys.map(keyToApiKey),
//     totalCount: mockKeys.length,
//   };

//   authorizationService.createProducerKeychainKey = vi
//     .fn()
//     .mockResolvedValue({ keys: mockKeys });

//   const makeRequest = async (token: string) =>
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
//       const res = await makeRequest(token);
//       expect(res.status).toBe(200);
//       expect(res.body).toEqual(apiKeys);
//     }
//   );

//   it.each(
//     Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
//   )("Should return 403 for user with role %s", async (role) => {
//     const token = generateToken(role);
//     const res = await makeRequest(token);
//     expect(res.status).toBe(403);
//   });
// });
