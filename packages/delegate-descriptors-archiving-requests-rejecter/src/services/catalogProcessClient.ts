import { catalogApi } from "pagopa-interop-api-clients";
import { DelegationId, DescriptorId, EServiceId } from "pagopa-interop-models";
import { InteropHeaders } from "pagopa-interop-commons";

export type ArchiveDelegatedArchivingRequestSeed = {
  descriptorId?: DescriptorId;
  reason: string;
  delegationId?: DelegationId;
  triggerEvent: string;
};

export type CatalogProcessClient = {
  archiveDelegatedArchivingRequest: (args: {
    eServiceId: EServiceId;
    seed: ArchiveDelegatedArchivingRequestSeed;
    headers: InteropHeaders;
  }) => Promise<void>;
};

export const catalogProcessClientBuilder = (
  url: string
): CatalogProcessClient => {
  const client = catalogApi.createProcessApiClient(url);

  return {
    async archiveDelegatedArchivingRequest({
      eServiceId,
      seed,
      headers,
    }): Promise<void> {
      await client.internalArchiveDelegatedArchivingRequest(seed, {
        params: {
          eServiceId,
        },
        headers,
      });
    },
  };
};
