import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  Attribute,
  Client,
  ClientJWKKey,
  Delegation,
  EService,
  EServiceTemplate,
  genericInternalError,
  ProducerJWKKey,
  ProducerKeychain,
  Purpose,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(readModel: ReadModelRepository) {
  return {
    async getAllReadModelPurposes(): Promise<Array<WithMetadata<Purpose>>> {
      const data = await readModel.purposes.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Purpose,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse purpose items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      const data = await readModel.agreements.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Agreement,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse agreement items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelClients(): Promise<Array<WithMetadata<Client>>> {
      const data = await readModel.clients.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Client,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse client items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelEServices(): Promise<Array<WithMetadata<EService>>> {
      const data = await readModel.eservices.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: EService,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse eservice items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelEServiceTemplates(): Promise<
      Array<WithMetadata<EServiceTemplate>>
    > {
      const data = await readModel.eserviceTemplates.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: EServiceTemplate,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse eservice template items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelAttributes(): Promise<Array<WithMetadata<Attribute>>> {
      const data = await readModel.attributes.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Attribute,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse attribute items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelTenants(): Promise<Array<WithMetadata<Tenant>>> {
      const data = await readModel.tenants.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Tenant,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse eservice items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelDelegations(): Promise<
      Array<WithMetadata<Delegation>>
    > {
      const data = await readModel.delegations.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: Delegation,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse delegation items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelProducerKeychains(): Promise<
      Array<WithMetadata<ProducerKeychain>>
    > {
      const data = await readModel.producerKeychains.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: ProducerKeychain,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse producer keychain items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelClientJWKKey(): Promise<
      Array<WithMetadata<ClientJWKKey>>
    > {
      const data = await readModel.keys.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: ClientJWKKey,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse client jwk key items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelProducerJWKKeys(): Promise<
      Array<WithMetadata<ProducerJWKKey>>
    > {
      const data = await readModel.producerKeys.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z
          .array(
            z.object({
              metadata: z.object({ version: z.number() }),
              data: ProducerJWKKey,
            })
          )
          .safeParse(data);
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse producer keychain jwk key items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },
  };
}
