import type {
  Operation,
  Package,
} from "pagopa-interop-dev-dashboard-contracts";

import {
  Boxes,
  Check,
  CircleAlert,
  Copy,
  Database,
  LoaderCircle,
  Play,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAccessToken } from "../hooks/useAccessToken";
import { paths } from "../router/paths";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Skeleton } from "./ui/skeleton";
import { Textarea } from "./ui/textarea";

type Props = {
  packages: Package[];
  seedPackages: string[];
  seedReady: boolean;
  operations: Operation[];
  busy?: string;
  prepareBusy?: string;
  onSeed: () => Promise<boolean>;
  onPrepare: () => Promise<boolean>;
};

export function TokenPanel({ seedPackages, ...props }: Props) {
  const model = useAccessToken({ seedPackages, ...props });
  return (
    <Card role="region" aria-labelledby="token-title">
      <CardHeader className="flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Toolbar className="shrink-0">
          <CardTitle asChild>
            <h2 id="token-title">Local access token</h2>
          </CardTitle>
          <Button
            variant="outline"
            size="icon"
            aria-label="Reload identities"
            title="Reload identities"
            aria-busy={model.loading}
            disabled={
              model.loading || model.reloadCooling || model.controlsBusy
            }
            onClick={() => void model.reloadIdentities()}
          >
            {model.loading ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : model.reloadCooling && model.reloadResult === "failed" ? (
              <CircleAlert aria-hidden="true" className="text-destructive" />
            ) : model.reloadCooling && model.reloadResult ? (
              <Check aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
          </Button>
        </Toolbar>
        <Toolbar>
          <Button
            variant="outline"
            size="sm"
            className="w-44"
            aria-label={
              model.prepareReady
                ? "Seed packages running"
                : "Start seed packages"
            }
            aria-busy={model.preparing}
            disabled={model.controlsBusy || model.prepareReady}
            onClick={() => void model.runTokenAction("seed.prepare")}
          >
            {model.preparing ? (
              <LoaderCircle
                data-icon="inline-start"
                aria-hidden="true"
                className="animate-spin"
              />
            ) : model.prepareReady ? (
              <Check data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Play data-icon="inline-start" aria-hidden="true" />
            )}
            {model.preparing && (
              <span className="sr-only" role="status">
                Starting seed packages
              </span>
            )}
            {model.prepareReady
              ? "Seed packages running"
              : "Start seed packages"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              to={`${paths.packages}?group=seed`}
              aria-label="View seed packages"
            >
              <Boxes data-icon="inline-start" aria-hidden="true" />
              Packages
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              to={`${paths.logs}?source=preset%3Atenant-seeding`}
              aria-label="Logs for seed packages"
            >
              <Terminal data-icon="inline-start" aria-hidden="true" />
              Logs
            </Link>
          </Button>
          <Button
            size="sm"
            className="w-40"
            aria-label={
              model.seedReady ? "Local data seeded" : "Seed local data"
            }
            title={model.seedReady ? "Local data seeded" : "Seed local data"}
            aria-busy={model.seeding}
            disabled={model.controlsBusy || model.seedReady}
            onClick={() => void model.runTokenAction("seed")}
          >
            {model.seeding ? (
              <LoaderCircle
                data-icon="inline-start"
                aria-hidden="true"
                className="animate-spin"
              />
            ) : model.seedReady ? (
              <Check data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Database data-icon="inline-start" aria-hidden="true" />
            )}
            {model.seeding && (
              <span className="sr-only" role="status">
                Seeding local data
              </span>
            )}
            {model.seedReady ? "Local data seeded" : "Seed local data"}
          </Button>
        </Toolbar>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {model.failedActions.map((kind) => (
          <ErrorAlert
            key={kind}
            message={
              kind === "seed" ? "Seed failed" : "Seed packages startup failed"
            }
            logsHref={`${paths.logs}?source=orchestration&level=error`}
          />
        ))}
        {model.error && <ErrorAlert message={model.error} />}
        {model.loading && !model.identities && !model.reloadCooling ? (
          <FieldGroup>
            <span role="status" className="sr-only">
              Loading local identities…
            </span>
            <Skeleton className="h-10 max-w-3xl" />
            <Skeleton className="h-10 max-w-3xl" />
          </FieldGroup>
        ) : !model.identities?.ready || !model.identities.tenants.length ? (
          <Empty
            role="region"
            aria-label="Local identities unavailable"
            className="items-start p-0 text-left md:p-0"
          >
            <EmptyHeader className="items-start">
              <EmptyDescription>
                Seed local data requires these packages to be running:
              </EmptyDescription>
            </EmptyHeader>
            <ul className="flex flex-col gap-1">
              {seedPackages.map((name) => (
                <li key={name}>
                  <code className="break-words text-xs">{name}</code>
                </li>
              ))}
            </ul>
          </Empty>
        ) : (
          <FieldGroup className="max-w-3xl">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-disabled={model.controlsBusy}>
                <FieldLabel htmlFor="identity-tenant">Tenant</FieldLabel>
                <NativeSelect
                  id="identity-tenant"
                  value={model.tenantKey}
                  disabled={model.controlsBusy}
                  onChange={(event) => model.selectTenant(event.target.value)}
                >
                  {model.identities.tenants.map((tenant) => (
                    <NativeSelectOption value={tenant.key} key={tenant.key}>
                      {tenant.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {model.tenant && (
                  <FieldDescription>
                    <code className="break-all">{model.tenant.id}</code>
                  </FieldDescription>
                )}
              </Field>
              <Field data-disabled={model.controlsBusy}>
                <FieldLabel htmlFor="identity-user">User</FieldLabel>
                <NativeSelect
                  id="identity-user"
                  value={model.userId}
                  disabled={model.controlsBusy || !model.tenant?.users.length}
                  onChange={(event) => model.selectUser(event.target.value)}
                >
                  {model.tenant?.users.map((user) => (
                    <NativeSelectOption value={user.id} key={user.id}>
                      {user.name} {user.surname} · {user.email}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {model.selectedUser && (
                  <FieldDescription>
                    Roles: {model.selectedUser.roles.join(", ") || "none"}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
            <Button
              className="self-start"
              disabled={model.controlsBusy || !model.tenantKey || !model.userId}
              onClick={() => void model.generate()}
            >
              {model.generating ? "Generating…" : "Generate token"}
            </Button>
            {model.token && (
              <Field>
                <Toolbar className="justify-between">
                  <FieldLabel htmlFor="session-token">Session token</FieldLabel>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void model.copy()}
                  >
                    {model.copied ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Copy data-icon="inline-start" aria-hidden="true" />
                    )}
                    {model.copied ? "Copied" : "Copy token"}
                  </Button>
                </Toolbar>
                <Textarea
                  id="session-token"
                  variant="code"
                  readOnly
                  value={model.token}
                  rows={4}
                />
                <FieldDescription>
                  Use this token only in the local development environment.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}
