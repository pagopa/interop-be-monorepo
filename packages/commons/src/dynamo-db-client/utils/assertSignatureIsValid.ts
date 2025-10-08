import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";

export function assertValidSignatureReferenceItem(
  item: Record<string, AttributeValue>,
  tableName: string,
  id: string
): asserts item is {
  safeStorageId: { S: string };
  correlationId: { S: string };
  fileKind: { S: string };
  fileName: { S: string };
  creationTimestamp: { N: string };
} {
  if (
    !item.safeStorageId?.S ||
    !item.correlationId?.S ||
    !item.fileKind?.S ||
    !item.fileName?.S ||
    !item.creationTimestamp?.N
  ) {
    throw genericInternalError(
      `Malformed item in table '${tableName}' for id='${id}'`
    );
  }
}
