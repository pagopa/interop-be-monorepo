import { and, countDistinct, eq, ilike, inArray } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";
import {
  ascLower,
  createListResult,
  escapeRegExp,
} from "pagopa-interop-commons";
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
  genericInternalError,
  ClientJWKKey,
  ProducerJWKKey,
  Tenant,
} from "pagopa-interop-models";
import {
  aggregateClientArray,
  aggregateProducerKeychainArray,
  AgreementReadModelService,
  CatalogReadModelService,
  ClientJWKKeyReadModelService,
  ClientReadModelService,
  DelegationReadModelService,
  ProducerJWKKeyReadModelService,
  ProducerKeychainReadModelService,
  PurposeReadModelService,
  TenantReadModelService,
  toClientAggregatorArray,
  toProducerKeychainAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  clientInReadmodelClient,
  clientJwkKeyInReadmodelClientJwkKey,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  producerJwkKeyInReadmodelProducerJwkKey,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";

export type GetClientsFilters = {
  name: string | undefined;
  userIds: UserId[];
  consumerId: TenantId | undefined;
  purposeId: PurposeId | undefined;
  kind: ClientKind | undefined;
};

export type GetProducerKeychainsFilters = {
  name: string | undefined;
  userIds: UserId[];
  producerId: TenantId | undefined;
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
  clientJWKKeyReadModelServiceSQL,
  producerJWKKeyReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  clientReadModelServiceSQL: ClientReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  purposeReadModelServiceSQL: PurposeReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
  producerKeychainReadModelServiceSQL: ProducerKeychainReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
  clientJWKKeyReadModelServiceSQL: ClientJWKKeyReadModelService;
  producerJWKKeyReadModelServiceSQL: ProducerJWKKeyReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
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

      return await readModelDB.transaction(async (tx) => {
        const totalCountQuery = tx
          .select({
            count: countDistinct(clientInReadmodelClient.id),
          })
          .from(clientInReadmodelClient)
          .$dynamic();

        const idsQuery = tx
          .select({ id: clientInReadmodelClient.id })
          .from(clientInReadmodelClient)
          .$dynamic();

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const buildQuery = <T extends PgSelect>(query: T) => {
          const subqueryWithFilters = tx
            .selectDistinctOn([clientInReadmodelClient.id], {
              id: clientInReadmodelClient.id,
            })
            .from(clientInReadmodelClient)
            .leftJoin(
              clientUserInReadmodelClient,
              eq(
                clientInReadmodelClient.id,
                clientUserInReadmodelClient.clientId
              )
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
                      `%${escapeRegExp(name)}%`
                    )
                  : undefined,
                // USERS FILTER
                userIds.length > 0
                  ? inArray(clientUserInReadmodelClient.userId, userIds)
                  : undefined,
                // CONSUMER FILTER
                consumerId
                  ? eq(clientInReadmodelClient.consumerId, consumerId)
                  : undefined,
                // PURPOSE FILTER
                purposeId
                  ? eq(clientPurposeInReadmodelClient.purposeId, purposeId)
                  : undefined,
                // KIND FILTER
                kind ? eq(clientInReadmodelClient.kind, kind) : undefined
              )
            )
            .groupBy(clientInReadmodelClient.id)
            .as("subquery");

          return query
            .innerJoin(
              subqueryWithFilters,
              eq(subqueryWithFilters.id, clientInReadmodelClient.id)
            )
            .$dynamic();
        };

        const idsSQLquery = buildQuery(idsQuery)
          .groupBy(clientInReadmodelClient.id)
          .orderBy(ascLower(clientInReadmodelClient.name))
          .limit(limit)
          .offset(offset);

        const ids = (await idsSQLquery).map((result) => result.id);

        const [queryResult, totalCount] = await Promise.all([
          tx
            .select({
              client: clientInReadmodelClient,
              clientUser: clientUserInReadmodelClient,
              clientPurpose: clientPurposeInReadmodelClient,
              clientKey: clientKeyInReadmodelClient,
            })
            .from(clientInReadmodelClient)
            .where(inArray(clientInReadmodelClient.id, ids))
            .leftJoin(
              clientUserInReadmodelClient,
              eq(
                clientInReadmodelClient.id,
                clientUserInReadmodelClient.clientId
              )
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
              eq(
                clientInReadmodelClient.id,
                clientKeyInReadmodelClient.clientId
              )
            )
            .orderBy(ascLower(clientInReadmodelClient.name)),
          buildQuery(totalCountQuery),
        ]);

        const clients = aggregateClientArray(
          toClientAggregatorArray(queryResult)
        );

        return createListResult(
          clients.map((c) => c.data),
          totalCount[0]?.count
        );
      });
    },
    async getClientsRelatedToPurpose(
      purposeId: PurposeId
    ): Promise<Array<WithMetadata<Client>>> {
      const subquery = readModelDB
        .select({
          clientId: clientInReadmodelClient.id,
        })
        .from(clientInReadmodelClient)
        .innerJoin(
          clientPurposeInReadmodelClient,
          and(
            eq(
              clientInReadmodelClient.id,
              clientPurposeInReadmodelClient.clientId
            ),
            eq(clientPurposeInReadmodelClient.purposeId, purposeId)
          )
        )
        .where(eq(clientPurposeInReadmodelClient.purposeId, purposeId))
        .groupBy(clientInReadmodelClient.id)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          client: clientInReadmodelClient,
          clientUser: clientUserInReadmodelClient,
          clientPurpose: clientPurposeInReadmodelClient,
          clientKey: clientKeyInReadmodelClient,
        })
        .from(clientInReadmodelClient)
        .innerJoin(subquery, eq(clientInReadmodelClient.id, subquery.clientId))
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

      const userId = queryResult[0].userId;
      if (userId === null) {
        throw genericInternalError("UserId can't be null in key");
      }

      return {
        userId: unsafeBrandId(userId),
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

      return await readModelDB.transaction(async (tx) => {
        const totalCountQuery = tx
          .select({
            count: countDistinct(
              producerKeychainInReadmodelProducerKeychain.id
            ),
          })
          .from(producerKeychainInReadmodelProducerKeychain)
          .$dynamic();

        const idsQuery = tx
          .select({ id: producerKeychainInReadmodelProducerKeychain.id })
          .from(producerKeychainInReadmodelProducerKeychain)
          .$dynamic();

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const buildQuery = <T extends PgSelect>(query: T) => {
          const subqueryWithFilters = tx
            .selectDistinctOn(
              [producerKeychainInReadmodelProducerKeychain.id],
              { id: producerKeychainInReadmodelProducerKeychain.id }
            )
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
                      `%${escapeRegExp(name)}%`
                    )
                  : undefined,
                // USERS FILTER
                userIds.length > 0
                  ? inArray(
                      producerKeychainUserInReadmodelProducerKeychain.userId,
                      userIds
                    )
                  : undefined,
                // PRODUCER FILTER
                producerId
                  ? eq(
                      producerKeychainInReadmodelProducerKeychain.producerId,
                      producerId
                    )
                  : undefined,
                // E-SERVICE FILTER
                eserviceId
                  ? eq(
                      producerKeychainEserviceInReadmodelProducerKeychain.eserviceId,
                      eserviceId
                    )
                  : undefined
              )
            )
            .as("subqueryWithFilters");

          return query
            .innerJoin(
              subqueryWithFilters,
              eq(
                producerKeychainInReadmodelProducerKeychain.id,
                subqueryWithFilters.id
              )
            )
            .$dynamic();
        };

        const idsSQLquery = buildQuery(idsQuery)
          .groupBy(producerKeychainInReadmodelProducerKeychain.id)
          .orderBy(ascLower(producerKeychainInReadmodelProducerKeychain.name))
          .limit(limit)
          .offset(offset);

        const ids = (await idsSQLquery).map((result) => result.id);

        const [queryResult, totalCount] = await Promise.all([
          tx
            .select({
              producerKeychain: producerKeychainInReadmodelProducerKeychain,
              producerKeychainUser:
                producerKeychainUserInReadmodelProducerKeychain,
              producerKeychainEService:
                producerKeychainEserviceInReadmodelProducerKeychain,
              producerKeychainKey:
                producerKeychainKeyInReadmodelProducerKeychain,
            })
            .from(producerKeychainInReadmodelProducerKeychain)
            .where(inArray(producerKeychainInReadmodelProducerKeychain.id, ids))
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
            .leftJoin(
              producerKeychainKeyInReadmodelProducerKeychain,
              eq(
                producerKeychainInReadmodelProducerKeychain.id,
                producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId
              )
            )
            .orderBy(
              ascLower(producerKeychainInReadmodelProducerKeychain.name)
            ),
          buildQuery(totalCountQuery),
        ]);

        const producerKeychains = aggregateProducerKeychainArray(
          toProducerKeychainAggregatorArray(queryResult)
        );

        return createListResult(
          producerKeychains.map((p) => p.data),
          totalCount[0]?.count
        );
      });
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
    async getClientJWKByKId(
      kId: ClientJWKKey["kid"]
    ): Promise<ClientJWKKey | undefined> {
      const clientKey =
        await clientJWKKeyReadModelServiceSQL.getClientJWKKeyByFilter(
          eq(clientJwkKeyInReadmodelClientJwkKey.kid, kId)
        );

      if (!clientKey?.data) {
        return undefined;
      }

      const parseResult = ClientJWKKey.safeParse(clientKey.data);
      if (!parseResult.success) {
        throw genericInternalError(
          `Unable to parse client key: result ${JSON.stringify(
            parseResult
          )} - data ${JSON.stringify(clientKey)}`
        );
      }

      return parseResult.data;
    },
    async getProducerJWKByKId(
      kId: ProducerJWKKey["kid"]
    ): Promise<ProducerJWKKey | undefined> {
      const producerKey =
        await producerJWKKeyReadModelServiceSQL.getProducerJWKKeyByFilter(
          eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kId)
        );

      if (!producerKey?.data) {
        return undefined;
      }

      const parseResult = ProducerJWKKey.safeParse(producerKey.data);
      if (!parseResult.success) {
        throw genericInternalError(
          `Unable to parse producer key: result ${JSON.stringify(
            parseResult
          )} - data ${JSON.stringify(producerKey)}`
        );
      }

      return parseResult.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
