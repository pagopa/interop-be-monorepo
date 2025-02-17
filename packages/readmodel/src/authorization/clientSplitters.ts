import { Client, dateToString } from "pagopa-interop-models";
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
  }: Client,
  metadataVersion: number
): {
  clientSQL: ClientSQL;
  clientUsersSQL: ClientUserSQL[];
  clientPurposesSQL: ClientPurposeSQL[];
  clientKeysSQL: ClientKeySQL[];
} => {
  void (rest satisfies Record<string, never>);

  const clientSQL: ClientSQL = {
    id,
    metadataVersion,
    consumerId,
    name,
    description: description || null,
    kind,
    createdAt: dateToString(createdAt),
  };

  const clientUsersSQL: ClientUserSQL[] = users.map((userId) => ({
    metadataVersion,
    clientId: id,
    userId,
  }));

  const clientPurposesSQL: ClientPurposeSQL[] = purposes.map((purposeId) => ({
    metadataVersion,
    clientId: id,
    purposeId,
  }));

  const clientKeysSQL: ClientKeySQL[] = keys.map((key) => ({
    metadataVersion,
    clientId: id,
    userId: key.userId,
    kid: key.kid,
    name: key.name,
    encodedPem: key.encodedPem,
    algorithm: key.algorithm,
    use: key.use,
    createdAt: dateToString(key.createdAt),
  }));

  return {
    clientSQL,
    clientUsersSQL,
    clientPurposesSQL,
    clientKeysSQL,
  };
};
