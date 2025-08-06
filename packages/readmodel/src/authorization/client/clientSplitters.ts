import { Client, dateToString } from "pagopa-interop-models";
import {
  ClientItemsSQL,
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "pagopa-interop-readmodel-models";

export const splitClientIntoObjectsSQL = (
  {
    id,
    consumerId,
    adminId,
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
): ClientItemsSQL => {
  void (rest satisfies Record<string, never>);

  const clientSQL: ClientSQL = {
    id,
    metadataVersion,
    consumerId,
    adminId: adminId || null,
    name,
    description: description || null,
    kind,
    createdAt: dateToString(createdAt),
  };

  const usersSQL: ClientUserSQL[] = users.map((userId) => ({
    metadataVersion,
    clientId: id,
    userId,
  }));

  const purposesSQL: ClientPurposeSQL[] = purposes.map((purposeId) => ({
    metadataVersion,
    clientId: id,
    purposeId,
  }));

  const keysSQL: ClientKeySQL[] = keys.map(
    ({
      userId,
      kid,
      name,
      encodedPem,
      algorithm,
      use,
      createdAt,
      ...keyRest
    }) => {
      void (keyRest satisfies Record<string, never>);

      return {
        metadataVersion,
        clientId: id,
        userId,
        kid,
        name,
        encodedPem,
        algorithm,
        use,
        createdAt: dateToString(createdAt),
      };
    }
  );

  return {
    clientSQL,
    usersSQL,
    purposesSQL,
    keysSQL,
  };
};
