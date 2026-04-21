import { describe, expect, it, vi } from "vitest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { clientNotFound } from "../src/model/errors.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { getBffMockContext } from "./utils.js";

describe("clientService", () => {
  it(
    "should throw clientNotFound when the retrieved client has partial visibility",
    async () => {
      const clientId = generateId<ClientId>();

      const mockClients = {
        authorizationClient: {
          client: {
            getClient: vi.fn().mockResolvedValue({
              id: clientId,
              consumerId: generateId(),
              kind: authorizationApi.ClientKind.Values.CONSUMER,
              visibility: authorizationApi.Visibility.Values.PARTIAL,
            } satisfies authorizationApi.PartialClient),
          },
        },
        tenantProcessClient: {
          tenant: {
            getTenant: vi.fn(),
          },
        },
        selfcareV2UserClient: {},
        inAppNotificationManagerClient: {},
      } as unknown as PagoPAInteropBeClients;

      const clientService = clientServiceBuilder(mockClients);
      const ctx = getBffMockContext(
        getMockContext({ authData: getMockAuthData() })
      );

      await expect(
        clientService.getClientById(clientId, ctx)
      ).rejects.toThrowError(clientNotFound(clientId));

      expect(
        mockClients.tenantProcessClient.tenant.getTenant
      ).not.toHaveBeenCalled();
    }
  );
});
