import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Client,
  WithMetadata,
  ClientId,
  UserId,
  PurposeId,
  TenantId,
  ListResult,
  EServiceId,
  EService,
  Purpose,
  Agreement,
  agreementState,
  Key,
  ClientKind,
  ProducerKeychain,
  ProducerKeychainId,
  DelegationId,
  delegationState,
  delegationKind,
  Delegation,
  unsafeBrandId,
  KeyUse,
  stringToDate,
} from "pagopa-interop-models";
import {
  aggregateClientArray,
  aggregateProducerKeychainArray,
  AgreementReadModelService,
  CatalogReadModelService,
  ClientReadModelService,
  DelegationReadModelService,
  ProducerKeychainReadModelService,
  PurposeReadModelService,
  toClientAggregatorArray,
  toProducerKeychainAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";

export type GetClientsFilters = {
  name?: string;
  userIds: UserId[];
  consumerId: TenantId;
  purposeId: PurposeId | undefined;
  kind?: ClientKind;
};

export type GetProducerKeychainsFilters = {
  name?: string;
  userIds: UserId[];
  producerId: TenantId;
  eserviceId: EServiceId | undefined;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  clientReadModelServiceSQL,
  catalogReadModelServiceSQL,
  purposeReadModelServiceSQL,
  producerKeychainReadModelServiceSQL,
  delegationReadModelServiceSQL,
  agreementReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  clientReadModelServiceSQL: ClientReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  purposeReadModelServiceSQL: PurposeReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
  producerKeychainReadModelServiceSQL: ProducerKeychainReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
}) {
  return {
    async getClientById(
      id: ClientId
    ): Promise<WithMetadata<Client> | undefined> {
      return clientReadModelServiceSQL.getClientById(id);
    },
    async getClients(
      filters: GetClientsFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Client>> {
      const { name, userIds, consumerId, purposeId, kind } = filters;

      const queryResult = await readModelDB.transaction(async (tx) => {
        const subquery = tx
          .select({
            clientId: clientInReadmodelClient.id,
            totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
          })
          .from(clientInReadmodelClient)
          .leftJoin(
            clientUserInReadmodelClient,
            eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
          )
          .leftJoin(
            clientPurposeInReadmodelClient,
            eq(
              clientInReadmodelClient.id,
              clientPurposeInReadmodelClient.clientId
            )
          )
          .where(
            and(
              // NAME FILTER
              name
                ? ilike(
                    clientInReadmodelClient.name,
                    `%${ReadModelRepository.escapeRegExp(name)}%`
                  )
                : undefined,
              // USERS FILTER
              userIds.length > 0
                ? inArray(clientUserInReadmodelClient.userId, userIds)
                : undefined,
              // CONSUMER FILTER
              eq(clientInReadmodelClient.consumerId, consumerId),
              // PURPOSE FILTER
              purposeId
                ? eq(clientPurposeInReadmodelClient.purposeId, purposeId)
                : undefined,
              // KIND FILTER
              kind ? eq(clientInReadmodelClient.kind, kind) : undefined
            )
          )
          .groupBy(clientInReadmodelClient.id)
          .limit(limit)
          .offset(offset)
          .orderBy(sql`LOWER(${clientInReadmodelClient.name})`)
          .as("subquery");

        return await tx
          .select({
            client: clientInReadmodelClient,
            clientUser: clientUserInReadmodelClient,
            clientPurpose: clientPurposeInReadmodelClient,
            clientKey: clientKeyInReadmodelClient,
            totalCount: subquery.totalCount,
          })
          .from(clientInReadmodelClient)
          .innerJoin(
            subquery,
            eq(clientInReadmodelClient.id, subquery.clientId)
          )
          .leftJoin(
            // 1
            clientUserInReadmodelClient,
            eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
          )
          .leftJoin(
            // 2
            clientPurposeInReadmodelClient,
            eq(
              clientInReadmodelClient.id,
              clientPurposeInReadmodelClient.clientId
            )
          )
          .leftJoin(
            // 3
            clientKeyInReadmodelClient,
            eq(clientInReadmodelClient.id, clientKeyInReadmodelClient.clientId)
          )
          .orderBy(sql`LOWER(${clientInReadmodelClient.name})`);
      });

      return {
        results: aggregateClientArray(toClientAggregatorArray(queryResult)).map(
          (c) => c.data
        ),
        totalCount: Number(queryResult[0]?.totalCount ?? 0),
      };
    },
    async getClientsRelatedToPurpose(
      purposeId: PurposeId
    ): Promise<Array<WithMetadata<Client>>> {
      const queryResult = await readModelDB.transaction(async (tx) => {
        const subquery = tx
          .select({
            clientId: clientInReadmodelClient.id,
          })
          .from(clientInReadmodelClient)
          .innerJoin(
            clientPurposeInReadmodelClient,
            eq(clientPurposeInReadmodelClient.purposeId, purposeId)
          )
          .groupBy(clientInReadmodelClient.id)
          .as("subquery");

        return await tx
          .select({
            client: clientInReadmodelClient,
            clientUser: clientUserInReadmodelClient,
            clientPurpose: clientPurposeInReadmodelClient,
            clientKey: clientKeyInReadmodelClient,
          })
          .from(clientInReadmodelClient)
          .innerJoin(
            subquery,
            eq(clientInReadmodelClient.id, subquery.clientId)
          )
          .leftJoin(
            clientUserInReadmodelClient,
            eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
          )
          .leftJoin(
            clientPurposeInReadmodelClient,
            eq(
              clientInReadmodelClient.id,
              clientPurposeInReadmodelClient.clientId
            )
          )
          .leftJoin(
            clientKeyInReadmodelClient,
            eq(clientInReadmodelClient.id, clientKeyInReadmodelClient.clientId)
          );
      });

      return aggregateClientArray(toClientAggregatorArray(queryResult));
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(eserviceId))
        ?.data;
    },
    async getPurposeById(purposeId: PurposeId): Promise<Purpose | undefined> {
      return (await purposeReadModelServiceSQL.getPurposeById(purposeId))?.data;
    },
    async getActiveOrSuspendedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      return (
        await agreementReadModelServiceSQL.getAgreementByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
            eq(agreementInReadmodelAgreement.consumerId, consumerId),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
      )?.data;
    },
    async getClientKeyByKid(kid: string): Promise<Key | undefined> {
      const queryResult = await readModelDB
        .select()
        .from(clientKeyInReadmodelClient)
        .where(eq(clientKeyInReadmodelClient.kid, kid))
        .limit(1);

      if (queryResult.length === 0) {
        return undefined;
      }

      return {
        userId: unsafeBrandId(queryResult[0].userId),
        kid: queryResult[0].kid,
        name: queryResult[0].name,
        encodedPem: queryResult[0].encodedPem,
        algorithm: queryResult[0].algorithm,
        use: KeyUse.parse(queryResult[0].use),
        createdAt: stringToDate(queryResult[0].createdAt),
      };
    },
    async getProducerKeychains(
      filters: GetProducerKeychainsFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<ProducerKeychain>> {
      const { name, userIds, producerId, eserviceId } = filters;

      const queryResult = await readModelDB.transaction(async (tx) => {
        const subquery = tx
          .select({
            producerKeychainId: producerKeychainInReadmodelProducerKeychain.id,
            totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
          })
          .from(producerKeychainInReadmodelProducerKeychain)
          .leftJoin(
            producerKeychainUserInReadmodelProducerKeychain,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainUserInReadmodelProducerKeychain.producerKeychainId
            )
          )
          .leftJoin(
            producerKeychainEserviceInReadmodelProducerKeychain,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
            )
          )
          .where(
            and(
              // NAME FILTER
              name
                ? ilike(
                    producerKeychainInReadmodelProducerKeychain.name,
                    `%${ReadModelRepository.escapeRegExp(name)}%`
                  )
                : undefined,
              // USERS FILTER
              userIds.length > 0
                ? inArray(
                    producerKeychainUserInReadmodelProducerKeychain.userId,
                    userIds
                  )
                : undefined,
              // CONSUMER FILTER
              eq(
                producerKeychainInReadmodelProducerKeychain.producerId,
                producerId
              ),
              // E-SERVICE FILTER
              eserviceId
                ? eq(
                    producerKeychainEserviceInReadmodelProducerKeychain.eserviceId,
                    eserviceId
                  )
                : undefined
            )
          )
          .groupBy(producerKeychainInReadmodelProducerKeychain.id)
          .limit(limit)
          .offset(offset)
          .orderBy(
            sql`LOWER(${producerKeychainInReadmodelProducerKeychain.name})`
          )
          .as("subquery");

        return await tx
          .select({
            producerKeychain: producerKeychainInReadmodelProducerKeychain,
            producerKeychainUser:
              producerKeychainUserInReadmodelProducerKeychain,
            producerKeychainEService:
              producerKeychainEserviceInReadmodelProducerKeychain,
            producerKeychainKey: producerKeychainKeyInReadmodelProducerKeychain,
            totalCount: subquery.totalCount,
          })
          .from(producerKeychainInReadmodelProducerKeychain)
          .innerJoin(
            subquery,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              subquery.producerKeychainId
            )
          )
          .leftJoin(
            // 1
            producerKeychainUserInReadmodelProducerKeychain,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainUserInReadmodelProducerKeychain.producerKeychainId
            )
          )
          .leftJoin(
            // 2
            producerKeychainEserviceInReadmodelProducerKeychain,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
            )
          )
          .leftJoin(
            // 3
            producerKeychainKeyInReadmodelProducerKeychain,
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId
            )
          )
          .orderBy(
            sql`LOWER(${producerKeychainInReadmodelProducerKeychain.name})`
          );
      });

      return {
        results: aggregateProducerKeychainArray(
          toProducerKeychainAggregatorArray(queryResult)
        ).map((c) => c.data),
        totalCount: Number(queryResult[0]?.totalCount ?? 0),
      };
    },
    async getProducerKeychainById(
      id: ProducerKeychainId
    ): Promise<WithMetadata<ProducerKeychain> | undefined> {
      return await producerKeychainReadModelServiceSQL.getProducerKeychainById(
        id
      );
    },
    async getProducerKeychainKeyByKid(kid: string): Promise<Key | undefined> {
      const queryResult = await readModelDB
        .select()
        .from(producerKeychainKeyInReadmodelProducerKeychain)
        .where(eq(producerKeychainKeyInReadmodelProducerKeychain.kid, kid))
        .limit(1);

      if (queryResult.length === 0) {
        return undefined;
      }

      return {
        userId: unsafeBrandId(queryResult[0].userId),
        kid: queryResult[0].kid,
        name: queryResult[0].name,
        encodedPem: queryResult[0].encodedPem,
        algorithm: queryResult[0].algorithm,
        use: KeyUse.parse(queryResult[0].use),
        createdAt: stringToDate(queryResult[0].createdAt),
      };
    },
    async getActiveConsumerDelegationById(
      id: DelegationId
    ): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.id, id),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        )
      )?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
