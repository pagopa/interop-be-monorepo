import {
  genericInternalError,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-models";

export const parseTenantSQL = (data: unknown): TenantSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantMailSQL = (
  data: unknown
): TenantMailSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantMailSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_mail sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantCertifiedAttributeSQL = (
  data: unknown
): TenantCertifiedAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantCertifiedAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_certified_attribute sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantDeclaredAttributeSQL = (
  data: unknown
): TenantDeclaredAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantDeclaredAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_declared_attribute sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantVerifiedAttributeSQL = (
  data: unknown
): TenantVerifiedAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantVerifiedAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_verified_attribute sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantVerifiedAttributeVerifierSQL = (
  data: unknown
): TenantVerifiedAttributeVerifierSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantVerifiedAttributeVerifierSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_verified_attribute_verifier sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantVerifiedAttributeRevokerSQL = (
  data: unknown
): TenantVerifiedAttributeRevokerSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantVerifiedAttributeRevokerSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_verified_attribute_revoker sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseTenantFeatureSQL = (
  data: unknown
): TenantFeatureSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = TenantFeatureSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse tenant_feature sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};
