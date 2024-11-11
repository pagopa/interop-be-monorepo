import {
  agreementApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { DB, FileManager } from "pagopa-interop-commons";
import {
  mockAuthenticationMiddleware,
  createMockedApiRequester,
} from "pagopa-interop-commons-test";
import { vi, inject } from "vitest";
import { postgresDB, fileManager, selfcareV2ClientMock } from "./utils.js";
const mockGetUserInfoUsingGET = vi.fn();

export function mockSelfcareV2ClientCall({
  value,
  mockedFor,
}: {
  value: Awaited<ReturnType<typeof selfcareV2ClientMock.getUserInfoUsingGET>>;
  mockedFor: "Router" | "Service";
}): void {
  if (mockedFor === "Router") {
    mockGetUserInfoUsingGET.mockImplementation(async () => value);
  } else {
    // eslint-disable-next-line functional/immutable-data
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(async () => value);
  }
}

vi.doMock("pagopa-interop-api-clients", async (importActual) => {
  const actual = await importActual<
    typeof import("pagopa-interop-api-clients")
  >();
  return {
    ...actual,
    selfcareV2UsersClientBuilder: (): SelfcareV2UsersClient =>
      ({
        getUserInfoUsingGET: mockGetUserInfoUsingGET,
      } as unknown as SelfcareV2UsersClient),
  };
});

vi.mock("pagopa-interop-commons", async (importActual) => {
  const actual = await importActual<typeof import("pagopa-interop-commons")>();
  return {
    ...actual,
    initDB: (): DB => postgresDB,
    initFileManager: (): FileManager => fileManager,
    authenticationMiddleware: mockAuthenticationMiddleware,
  };
});

vi.mock("../src/config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/config/config.js")>();
  return {
    ...actual,
    ...inject("readModelConfig"),
    ...inject("eventStoreConfig"),
    ...inject("fileManagerConfig"),
  };
});

const { default: app } = await import("../src/app.js");

export const mockAgreementRouterRequest =
  createMockedApiRequester<typeof agreementApi.agreementEndpoints>(app);
