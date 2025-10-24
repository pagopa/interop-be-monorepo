// TO DO REMOVE ONCE DOCUMENT-SIGNER MERGED
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";

export function assertValidDocumentSignatureReferenceItem(
  item: Record<string, AttributeValue>,
  tableName: string,
  id: string
): asserts item is {
  safeStorageId: { S: string };
  fileKind: { S: string };
  streamId: { S: string };
  subObjectId: { S: string };
  contentType: { S: string };
  path: { S: string };
  prettyname: { S: string };
  fileName: { S: string };
  version: { N: string };
  createdAt: { N: string };
  creationTimestamp: { N: string };
} {
  if (
    !item.safeStorageId?.S ||
    !item.fileKind?.S ||
    !item.streamId?.S ||
    !item.subObjectId?.S ||
    !item.contentType?.S ||
    !item.path?.S ||
    !item.prettyname?.S ||
    !item.fileName?.S ||
    !item.version?.N ||
    !item.createdAt?.N ||
    !item.creationTimestamp?.N
  ) {
    throw genericInternalError(
      `Malformed document item in table '${tableName}' for id='${id}'`
    );
  }
}
