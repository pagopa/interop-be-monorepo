import {
  Client,
  ClientId,
  ClientKind,
  Key,
  KeyUse,
  PurposeId,
  stringToDate,
  TenantId,
  unsafeBrandId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import { ClientItemsSQL, ClientKeySQL } from "pagopa-interop-readmodel-models";

export const clientSQLToClient = ({
  clientSQL: {
    id,
    metadataVersion,
    consumerId,
    name,
    description,
    kind,
    createdAt,
    ...rest
  },
  usersSQL,
  purposesSQL,
  keysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
  void (rest satisfies Record<string, never>);

  const users: UserId[] = usersSQL.map((u) => unsafeBrandId<UserId>(u.userId));
  const purposes: PurposeId[] = purposesSQL.map((p) =>
    unsafeBrandId<PurposeId>(p.purposeId)
  );
  const keys: Key[] = keysSQL.map(
    ({
      userId,
      kid,
      name,
      encodedPem,
      algorithm,
      use,
      createdAt,
      ...keyRest
    }: Omit<ClientKeySQL, "metadataVersion" | "clientId">) => {
      void (keyRest satisfies Record<string, never>);

      return {
        userId: unsafeBrandId<UserId>(userId),
        kid,
        name,
        encodedPem,
        algorithm,
        use: KeyUse.parse(use),
        createdAt: stringToDate(createdAt),
      };
    }
  );

  return {
    data: {
      id: unsafeBrandId<ClientId>(id),
      consumerId: unsafeBrandId<TenantId>(consumerId),
      name,
      purposes,
      description: description || undefined,
      users,
      kind: ClientKind.parse(kind),
      createdAt: stringToDate(createdAt),
      keys,
    },
    metadata: { version: metadataVersion },
  };
};
