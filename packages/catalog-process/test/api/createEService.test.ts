// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// import request from "supertest";
// import { describe, it, expect, vi, afterAll } from "vitest";
// import { AuthData, userRoles } from "pagopa-interop-commons";
// import jwt from "jsonwebtoken";
// import { SelfcareId, TenantId, UserId } from "pagopa-interop-models";
// import { response } from "express";
// import {
//   buildDescriptorSeedForEserviceCreation,
//   getMockAuthData,
//   mockAuthenticationMiddleware,
// } from "../mockUtils.js";
// import { createPayload } from "../mockedPayloadForToken.js";

// vi.mock("pagopa-interop-commons", async (importActual) => {
//   console.log("Middleware mockato chiamato");
//   const actual = await importActual<typeof import("pagopa-interop-commons")>();
//   return {
//     ...actual,
//     initDB: vi.fn(), // Evita qualsiasi connessione a DB
//     authenticationMiddleware: mockAuthenticationMiddleware,
//   };
// });

// // Mock del service
// vi.mock("../src/services/catalogService", async (importActual) => {
//   const originalModule = await importActual<
//     typeof import("../../src/services/catalogService.js")
//   >();

//   return {
//     ...originalModule,
//     catalogServiceBuilder: vi.fn(() => ({
//       ...originalModule.catalogServiceBuilder,
//       createEService: vi.fn().mockResolvedValue({
//         id: "123",
//         producerId: "ed6e288d-c9cf-4c9c-893d-0a051dac638a",
//         name: "Mocked EService",
//         description: "Mocked description",
//         technology: "API",
//         mode: "STANDARD",
//         attributes: undefined,
//         descriptors: [],
//         createdAt: new Date(),
//         riskAnalysis: [],
//         isSignalHubEnabled: false,
//         isConsumerDelegable: false,
//         isClientAccessDelegable: false,
//       }),
//     })),
//   };
// });

// import { api } from "../vitestAPISetup.js";

// describe("Test autorizzazione API /eservices", async () => {
//   const validToken = jwt.sign(
//     createPayload({
//       ...getMockAuthData("ed6e288d-c9cf-4c9c-893d-0a051dac638a" as TenantId),
//       userId: "2098e3bd-f2bb-4695-8d54-efcea7dc1092" as UserId,
//       selfcareId: "2efb2a51-9fdc-4ce6-9d24-875b7d834839" as SelfcareId,
//       userRoles: [userRoles.ADMIN_ROLE],
//     } satisfies AuthData),
//     "test-secret"
//   );

//   const decoded = jwt.verify(validToken, "test-secret");

//   console.log("decoded", decoded);

//   console.log("validToken", validToken);

//   it("Dovrebbe restituire 200 per un utente con ADMIN_ROLE", async () => {
//     await request(api)
//       .post("/eservices")
//       .set("Authorization", `Bearer ${validToken}`)
//       .set("X-Correlation-Id", "79eb4963-3866-422f-8ef0-87871e5f9a71")
//       .send({
//         name: mockEService.name,
//         description: mockEService.description,
//         technology: "REST",
//         mode: "DELIVER",
//         descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
//         isSignalHubEnabled,
//         isConsumerDelegable,
//         isClientAccessDelegable,
//       })
//       .expect(200);
//   });
//   // console.log("response", response);

//   expect(response.status).toBe(200);
//   // expect(response.body).toMatchObject({
//   //   id: "123",
//   //   name: "Mocked EService",
//   // });
// });

// afterAll(() => {
//   vi.restoreAllMocks();
// });

/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthData, userRoles } from "pagopa-interop-commons";
import { SelfcareId, TenantId, UserId } from "pagopa-interop-models";
import { mockAuthenticationMiddleware } from "../mockUtils.js";

// Mock di pagopa-interop-commons PRIMA di qualsiasi importazione
vi.doMock("pagopa-interop-commons", async () => {
  console.log("Middleware mockato chiamato");
  const actual = await import("pagopa-interop-commons");
  return {
    ...actual,
    initDB: vi.fn(), // Evita qualsiasi connessione a DB
    authenticationMiddleware: mockAuthenticationMiddleware,
  };
});

// Mock del service PRIMA di qualsiasi importazione
vi.doMock("../src/services/catalogService", async () => ({
  catalogServiceBuilder: vi.fn(() => ({
    createEService: vi.fn().mockResolvedValue({
      id: "123",
      producerId: "ed6e288d-c9cf-4c9c-893d-0a051dac638a",
      name: "Mocked EService",
      description: "Mocked description",
      technology: "API",
      mode: "STANDARD",
      attributes: undefined,
      descriptors: [],
      createdAt: new Date(),
      riskAnalysis: [],
      isSignalHubEnabled: false,
      isConsumerDelegable: false,
      isClientAccessDelegable: false,
    }),
  })),
}));

// Ora possiamo importare gli altri moduli
import {
  buildDescriptorSeedForEserviceCreation,
  getMockAuthData,
  getMockDescriptor,
} from "../mockUtils.js";
import { createPayload } from "../mockedPayloadForToken.js";
import { api } from "../vitestAPISetup.js";

describe("Test autorizzazione API /eservices", async () => {
  const mockDescriptor = getMockDescriptor();
  // eslint-disable-next-line functional/no-let
  let validToken: string;

  beforeAll(() => {
    validToken = jwt.sign(
      createPayload({
        ...getMockAuthData("ed6e288d-c9cf-4c9c-893d-0a051dac638a" as TenantId),
        userId: "2098e3bd-f2bb-4695-8d54-efcea7dc1092" as UserId,
        selfcareId: "2efb2a51-9fdc-4ce6-9d24-875b7d834839" as SelfcareId,
        userRoles: [userRoles.ADMIN_ROLE],
      } satisfies AuthData),
      "test-secret"
    );

    console.log("decoded", jwt.verify(validToken, "test-secret"));
    console.log("validToken", validToken);
  });

  it("Dovrebbe restituire 200 per un utente con ADMIN_ROLE", async () => {
    const res = await request(api)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", "79eb4963-3866-422f-8ef0-87871e5f9a71")
      .send({
        name: "Mocked EService",
        description: "Mocked Description",
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      });
    expect(res.status).toBe(200);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
