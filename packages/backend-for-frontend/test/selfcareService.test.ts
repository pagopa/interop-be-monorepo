import { AxiosError, AxiosResponse } from "axios";
import { genericLogger, WithLogger } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { describe, expect, it, vi } from "vitest";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { selfcareServiceBuilder } from "../src/services/selfcareService.js";
import { BffAppContext } from "../src/utilities/context.js";

const axiosErrorWithStatus = (status: number): AxiosError =>
  new AxiosError("Selfcare error", undefined, undefined, undefined, {
    status,
    statusText: "Selfcare error",
  } as AxiosResponse);

const buildService = (error: AxiosError) => {
  const getInstitutionProductsUsingGET = vi.fn().mockRejectedValue(error);
  const clients = {
    selfcareV2InstitutionClient: { getInstitutionProductsUsingGET },
  } as unknown as PagoPAInteropBeClients;

  return {
    service: selfcareServiceBuilder(clients),
    getInstitutionProductsUsingGET,
  };
};

const context = {
  ...getMockContext({ authData: getMockAuthData() }),
  logger: genericLogger,
} as WithLogger<BffAppContext>;

// CI trigger for PIN-8874 validation.
describe("selfcareServiceBuilder.getSelfcareInstitutionsProducts", () => {
  it("should return an empty product list when Selfcare returns a server error", async () => {
    const { service } = buildService(axiosErrorWithStatus(500));

    await expect(
      service.getSelfcareInstitutionsProducts(context)
    ).resolves.toEqual([]);
  });

  it("should propagate non-server errors returned by Selfcare", async () => {
    const error = axiosErrorWithStatus(404);
    const { service } = buildService(error);

    await expect(service.getSelfcareInstitutionsProducts(context)).rejects.toBe(
      error
    );
  });
});
