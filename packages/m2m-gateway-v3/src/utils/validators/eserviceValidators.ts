import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";

import {
  invalidSeedForEService,
  invalidSeedForEServiceTemplateInstance,
} from "../../model/errors.js";

export function assertSeedPatchEServiceTemplateInstanceUpdateContent(
  updateSeed:
    | m2mGatewayApiV3.EServiceDraftUpdateSeed
    | m2mGatewayApiV3.UpdateEServiceTemplateInstanceSeed
): asserts updateSeed is m2mGatewayApiV3.UpdateEServiceTemplateInstanceSeed {
  const result =
    m2mGatewayApiV3.UpdateEServiceTemplateInstanceSeed.safeParse(updateSeed);
  if (!result.success) {
    throw invalidSeedForEServiceTemplateInstance(
      result.error.issues.map((i) => i.message)
    );
  }
}

export function assertSeedEServiceDescriptorContent(
  descriptorSeed:
    | m2mGatewayApiV3.EServiceDescriptorSeed
    | m2mGatewayApiV3.EServiceInstanceDescriptorSeed
): asserts descriptorSeed is m2mGatewayApiV3.EServiceDescriptorSeed {
  const result =
    m2mGatewayApiV3.EServiceDescriptorSeed.safeParse(descriptorSeed);
  if (!result.success) {
    throw invalidSeedForEService(result.error.issues.map((i) => i.message));
  }
}

export function assertSeedEServiceTemplateInstanceDescriptorContent(
  descriptorSeed:
    | m2mGatewayApiV3.EServiceDescriptorSeed
    | m2mGatewayApiV3.EServiceInstanceDescriptorSeed
): asserts descriptorSeed is m2mGatewayApiV3.EServiceInstanceDescriptorSeed {
  const result =
    m2mGatewayApiV3.EServiceInstanceDescriptorSeed.safeParse(descriptorSeed);
  if (!result.success) {
    throw invalidSeedForEServiceTemplateInstance(
      result.error.issues.map((i) => i.message)
    );
  }
}

export function assertSeedPatchEServiceTemplateInstanceDescriptorUpdateContent(
  updateSeed:
    | m2mGatewayApiV3.EServiceDescriptorDraftUpdateSeed
    | m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed
): asserts updateSeed is m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed {
  const result =
    m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed.safeParse(
      updateSeed
    );
  if (!result.success) {
    throw invalidSeedForEServiceTemplateInstance(
      result.error.issues.map((i) => i.message)
    );
  }
}

export function assertSeedPatchEServiceTemplateInstanceDescriptorQuotasUpdateContent(
  updateSeed:
    | m2mGatewayApiV3.EServiceDescriptorQuotasUpdateSeed
    | m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed
): asserts updateSeed is m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed {
  const result =
    m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed.safeParse(
      updateSeed
    );
  if (!result.success) {
    throw invalidSeedForEServiceTemplateInstance(
      result.error.issues.map((i) => i.message)
    );
  }
}
