export const buildSelfcareTenantSeed = (tenant) => ({
  externalId: tenant.externalId,
  name: tenant.name,
  selfcareId: tenant.selfcareId,
  selfcareInstitutionType: tenant.institutionType,
  onboardedAt: "2024-01-01T00:00:00.000Z",
});

export const buildTenantContactMailSeed = (tenant) => ({
  kind: "CONTACT_EMAIL",
  address: tenant.contactEmail,
  description: "Local development contact email",
});

export const hasTenantContactEmail = (tenant, contactEmail) =>
  tenant.mails.some(
    (mail) =>
      mail.kind === "CONTACT_EMAIL" && mail.address === contactEmail
  );

const getUserMembership = (user, tenantSelfcareId) =>
  user.memberships.find(
    (membership) => membership.tenantSelfcareId === tenantSelfcareId
  );

export const selectIdentity = (
  dataset,
  state,
  tenantKey,
  userId
) => {
  const tenantDefinition = dataset.tenants.find(
    (tenant) => tenant.key === tenantKey
  );
  const tenantState = state.tenants[tenantKey];
  if (!tenantDefinition || !tenantState) {
    throw new Error(`Unknown or unseeded local tenant ${tenantKey}`);
  }

  const user = dataset.users.find(
    (candidate) =>
      getUserMembership(candidate, tenantDefinition.selfcareId) &&
      (!userId || candidate.id === userId || candidate.key === userId)
  );
  if (!user) {
    throw new Error(`No local user configured for tenant ${tenantKey}`);
  }
  const membership = getUserMembership(user, tenantDefinition.selfcareId);

  return {
    tenant: { ...tenantDefinition, id: tenantState.id },
    user,
    roles: membership.roles,
  };
};

export const buildSessionClaims = ({ tenant, user, roles }) => ({
  email: user.email,
  externalId: tenant.externalId,
  family_name: user.surname,
  name: user.name,
  organization: {
    fiscal_code: tenant.externalId.value,
    id: tenant.selfcareId,
    ipaCode: tenant.externalId.value,
    name: tenant.name,
    roles: roles.map((role) => ({ partyRole: "MANAGER", role })),
  },
  organizationId: tenant.id,
  selfcareId: tenant.selfcareId,
  uid: user.id,
  "user-roles": roles.join(","),
});

export const buildTokenPayload = ({ claims, kind, now, durationSeconds }) => {
  const common = {
    aud:
      kind === "session"
        ? "dev.interop.pagopa.it/ui"
        : "dev.interop.pagopa.it/internal",
    exp: now + durationSeconds,
    iat: now,
    iss: "dev.interop.pagopa.it",
    jti: crypto.randomUUID(),
    nbf: now,
  };

  if (kind === "session") {
    return { ...common, ...claims };
  }

  return {
    ...common,
    role: kind,
    sub: `local-development-${kind}`,
  };
};
