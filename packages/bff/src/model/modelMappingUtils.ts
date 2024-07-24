import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import {
  agreementApiState,
  catalogApiDescriptorState,
} from "./api/apiTypes.js";

export function isUpgradable(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): boolean {
  const eserviceDescriptor = eservice.descriptors.find(
    (e) => e.id === agreement.descriptorId
  );

  return (
    eserviceDescriptor !== undefined &&
    eservice.descriptors
      .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
      .find(
        (d) =>
          (d.state === catalogApiDescriptorState.PUBLISHED ||
            d.state === catalogApiDescriptorState.SUSPENDED) &&
          (agreement.state === agreementApiState.ACTIVE ||
            agreement.state === agreementApiState.SUSPENDED)
      ) !== undefined
  );
}
