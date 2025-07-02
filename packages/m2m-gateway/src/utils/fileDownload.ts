import { agreementApi, catalogApi } from "pagopa-interop-api-clients";

export function downloadDocument(
  docObject: catalogApi.EServiceDoc | agreementApi.Document,
  fileContent: Uint8Array
): File {
  return new File([fileContent], docObject.name, {
    type: docObject.contentType,
  });
}
