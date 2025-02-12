import { ClientReadModel } from "pagopa-interop-models";
import {
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "../types.js";

export const splitClientIntoObjectsSQL = (
  {
    id,
    consumerId,
    name,
    purposes,
    description,
    users,
    kind,
    createdAt,
    keys,
    ...rest
  }: ClientReadModel,
  version: number
): {
  clientSQL: ClientSQL;
  clientUsersSQL: ClientUserSQL[];
  clientPurposesSQL: ClientPurposeSQL[];
  clientKeysSQL: ClientKeySQL[];
} => {
  void (rest satisfies Record<string, never>);

  const clientSQL: ClientSQL = {
    id,
    metadataVersion: version,
    consumerId,
    name,
    description: description || "",
    kind,
    createdAt,
  };

  const clientUsersSQL: ClientUserSQL[] = users.map((userId) => ({
    metadataVersion: version,
    clientId: id,
    userId,
  }));

  const clientPurposesSQL: ClientPurposeSQL[] = purposes.map((purposeId) => ({
    metadataVersion: version,
    clientId: id,
    purposeId,
  }));

  const clientKeysSQL: ClientKeySQL[] = keys.map((key) => ({
    metadataVersion: version,
    clientId: id,
    userId: key.userId,
    kid: key.kid,
    name: key.name,
    encodedPem: key.encodedPem,
    algorithm: key.algorithm,
    use: key.use,
    createdAt: key.createdAt,
  }));

  return {
    clientSQL,
    clientUsersSQL,
    clientPurposesSQL,
    clientKeysSQL,
  };
};
