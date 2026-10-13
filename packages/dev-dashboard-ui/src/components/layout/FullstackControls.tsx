import { Play, RefreshCw, Square } from "lucide-react";
import { useState } from "react";

import { useDashboardContext } from "../../providers/DashboardProvider";
import { Button } from "../ui/button";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";

export function FullstackControls() {
  const dashboard = useDashboardContext();
  const [mode, setMode] = useState<"local" | "dev">("local");
  const { status, busy } = dashboard;
  if (!status?.frontendAvailable) return null;
  const disabled = Boolean(busy.fullstack || busy.frontend);
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() =>
          void dashboard.runAction({ type: "fullstack.start" }, "fullstack")
        }
      >
        <Play data-icon="inline-start" />
        {busy.fullstack ? "Working…" : "Start fullstack"}
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          void dashboard.runAction({ type: "fullstack.stop" }, "fullstack")
        }
      >
        <Square data-icon="inline-start" />
        Stop fullstack
      </Button>
      <NativeSelect
        aria-label="Frontend environment"
        className="w-32"
        value={mode}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "local" || next === "dev") setMode(next);
        }}
      >
        <NativeSelectOption value="local">FE local</NativeSelectOption>
        <NativeSelectOption value="dev">FE dev</NativeSelectOption>
      </NativeSelect>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          void dashboard.runAction(
            { type: "frontend.restart", mode },
            "frontend"
          )
        }
      >
        <RefreshCw data-icon="inline-start" />
        {busy.frontend ? "Restarting…" : "Restart frontend"}
      </Button>
    </>
  );
}
