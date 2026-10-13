import {
  schemas,
  type DashboardAction,
  type IdentityInput,
  type PresetInput,
} from "pagopa-interop-dev-dashboard-contracts";
import { z } from "zod";

import { request } from "../client";

export type {
  DashboardAction,
  DashboardStatus,
  LogEntry,
  LogsResponse,
  Operation,
  Phase,
  PresetInput,
} from "pagopa-interop-dev-dashboard-contracts";

export type LogFilters = {
  source?: string;
  service?: string;
  level?: string;
  search?: string;
  cid?: string;
  cursors?: Record<string, string>;
  limit?: number;
};

function getStatus(signal?: AbortSignal) {
  return request("/status", schemas.DashboardStatus, { signal });
}

function getIdentities(signal?: AbortSignal) {
  return request("/identities", schemas.IdentitiesResponse, { signal });
}

function getLogs(
  { cursors, limit, ...filters }: LogFilters,
  signal?: AbortSignal
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  if (limit !== undefined) params.set("limit", String(limit));
  if (cursors && Object.keys(cursors).length)
    params.set("cursors", JSON.stringify(cursors));
  return request(`/logs?${params}`, schemas.LogsResponse, { signal });
}

function generateToken(input: IdentityInput) {
  return request("/identity", schemas.SessionResponse, {
    method: "POST",
    data: schemas.IdentityInput.parse(input),
  });
}

function runAction(action: DashboardAction) {
  return request("/actions", schemas.OperationAccepted, {
    method: "POST",
    data: schemas.DashboardAction.parse(action),
  });
}

function savePreset(input: PresetInput) {
  return request("/presets", schemas.Preset, {
    method: "POST",
    data: schemas.PresetInput.parse(input),
  });
}

function deletePreset(id: string) {
  return request(`/presets/${encodeURIComponent(id)}`, z.void(), {
    method: "DELETE",
  });
}

export const DashboardService = {
  getStatus,
  getIdentities,
  getLogs,
  generateToken,
  runAction,
  savePreset,
  deletePreset,
};
