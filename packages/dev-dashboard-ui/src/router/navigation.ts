import { Boxes, Database, KeyRound, Layers, Terminal } from "lucide-react";

import { paths } from "./paths";

export const navigation = [
  { path: paths.packages, label: "Packages", icon: Boxes },
  { path: paths.presets, label: "Presets", icon: Layers },
  { path: paths.infrastructure, label: "Infrastructure", icon: Database },
  { path: paths.accessToken, label: "Access token", icon: KeyRound },
  { path: paths.logs, label: "Logs", icon: Terminal },
];
