import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { eserviceTemplateVersionNotInSuspendedState } from "../../model/errors.js";

export function assertEServiceTemplateVersionIsSuspended(
  version: eserviceTemplateApi.EServiceTemplateVersion
): void {
  if (
    version.state !==
    eserviceTemplateApi.EServiceTemplateVersionState.Values.SUSPENDED
  ) {
    throw eserviceTemplateVersionNotInSuspendedState(version.id);
  }
}
