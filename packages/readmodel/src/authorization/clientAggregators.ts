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
import { ClientItemsSQL } from "pagopa-interop-readmodel-models";

// TODO: ...rest?
export const clientSQLToClient = ({
  clientSQL,
  usersSQL,
  purposesSQL,
  keysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
  const users: UserId[] = usersSQL.map((u) => unsafeBrandId<UserId>(u.userId));
  const purposes: PurposeId[] = purposesSQL.map((p) =>
    unsafeBrandId<PurposeId>(p.purposeId)
  );
  const keys: Key[] = keysSQL.map((k) => ({
    userId: unsafeBrandId<UserId>(k.userId),
    kid: k.kid,
    name: k.name,
    encodedPem: k.encodedPem,
    algorithm: k.algorithm,
    use: KeyUse.parse(k.use),
    createdAt: stringToDate(k.createdAt),
  }));

  return {
    data: {
      id: unsafeBrandId<ClientId>(clientSQL.id),
      consumerId: unsafeBrandId<TenantId>(clientSQL.consumerId),
      name: clientSQL.name,
      purposes,
      description: clientSQL.description || undefined,
      users,
      kind: ClientKind.parse(clientSQL.kind),
      createdAt: stringToDate(clientSQL.createdAt),
      keys,
    },
    metadata: { version: clientSQL.metadataVersion },
  };
};
