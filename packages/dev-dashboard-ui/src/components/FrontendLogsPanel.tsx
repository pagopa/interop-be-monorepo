import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  schemas,
  type FrontendLogSource,
} from "pagopa-interop-dev-dashboard-contracts";
import { useState } from "react";

import { DashboardQueries } from "../api/dashboard/dashboard.queries";
import { errorMessage } from "../lib/utils";
import { ErrorAlert } from "./common/ErrorAlert";
import { Button } from "./ui/button";
import { Field, FieldLabel } from "./ui/field";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Skeleton } from "./ui/skeleton";

export function FrontendLogsPanel({ enabled }: { enabled: boolean }) {
  const [source, setSource] = useState<FrontendLogSource>("startup");
  const query = useQuery({ ...DashboardQueries.frontendLogs(source), enabled });
  return (
    <section
      role="region"
      aria-labelledby="frontend-logs-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 id="frontend-logs-title" className="text-base font-semibold">
          Frontend logs
        </h3>
        <div className="flex items-end gap-2">
          <Field>
            <FieldLabel htmlFor="frontend-log-source">
              Frontend log source
            </FieldLabel>
            <NativeSelect
              id="frontend-log-source"
              value={source}
              disabled={!enabled}
              onChange={(event) => {
                const selected = schemas.FrontendLogSource.safeParse(
                  event.target.value
                );
                if (selected.success) setSource(selected.data);
              }}
            >
              <NativeSelectOption value="startup">Startup</NativeSelectOption>
              <NativeSelectOption value="vite">Vite</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh frontend logs"
            disabled={query.isFetching || !enabled}
            onClick={() => void query.refetch()}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </div>
      {enabled && query.error && (
        <ErrorAlert message={errorMessage(query.error)} />
      )}
      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          Frontend logs are unavailable while the frontend runtime cannot be
          reached.
        </p>
      ) : query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        query.data && (
          <pre
            tabIndex={0}
            aria-label={`${source === "startup" ? "Startup" : "Vite"} log output`}
            className="max-h-80 overflow-auto rounded-md border bg-muted p-4 text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {query.data?.content ||
              "No output yet. Logs appear when the frontend launcher writes output."}
          </pre>
        )
      )}
    </section>
  );
}
