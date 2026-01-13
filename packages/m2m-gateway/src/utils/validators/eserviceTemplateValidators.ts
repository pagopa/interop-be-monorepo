import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { eserviceTemplateVersionNotInSuspendedState } from "../../model/errors.js";

export function assertEServiceTemplateVersionIsSuspended(
  eserviceTemplateId: string,
  version: eserviceTemplateApi.EServiceTemplateVersion
): void {
  if (
    version.state !==
    eserviceTemplateApi.EServiceTemplateVersionState.Values.SUSPENDED
  ) {
    throw eserviceTemplateVersionNotInSuspendedState(
      eserviceTemplateId,
      version.id
    );
  }
}
