# Development dashboard

## Register

product

## Users

PDND backend and frontend developers working against local infrastructure on Linux,
macOS or Windows through WSL2. They need to launch a few services, inspect their
logs, or prepare the backend used by a fullstack environment.

## Product Purpose

A backend-owned development tool available independently of Vite and VS Code.
The dashboard controls backend processes and infrastructure, keeping failures
and runtime state visible. The frontend launcher owns Vite and frontend checks
in a separate devcontainer and coordinates backend actions through the API.

## Brand Personality

Clear, practical, dependable. Familiar PDND colours connect the tool to the
project while standard controls keep attention on development work.

## Design Principles

- Show the real state of actions and individual services.
- Keep service actions close to their status and logs.
- Starting a package or preset adds processes without disrupting other work.
- Keep package management to name, port, state, watch and Start/Stop/Logs.
- Use row selection and a compact table toolbar for bulk Start, Stop and Watch.
  Keep rows vertically aligned, with the selection count on the left and bulk
  controls on the right. Busy buttons show progress; failure details belong in
  Logs.
  Watch changes keep Start/Stop visually stable while conflicting controls remain
  disabled. Keep the content scrollbar present so filtering does not resize tables.
  Use compact rows and monospace workspace names in the catalogue and preset editor.
- Keep infrastructure data deletion explicit and separate from stopping.
  Use compact rows and order header actions Reset, Stop, Start, with an outlined
  destructive Reset button and confirmation before deletion.
  Destructive confirmations use a red action button and a delete icon.
- Give packages, presets, infrastructure, access tokens and logs their own
  addressable views. Package log actions open the log view
  with the source selected; browser history and refresh retain the view.
- Show startup progress in buttons on Packages, Presets, Infrastructure and
  Access token. Keep startup details in logs and avoid operation timelines or
  history pages.
- Discover runnable packages from the checkout instead of maintaining dependency
  or support profiles. Service groups are explicit presets.
- Separate shared and local presets. Create and edit local presets in a modal
  with package search that preserves selections and watch choices, a total
  selection count and a stable table layout. The selection count badge keeps a
  fixed width and height as the count changes. Open their
  members in Packages with an addressable preset filter.
  Hide empty local sections and filter groups. A fully running preset shows its
  state and disables Start; Start and Stop show loading on the pressed button.
  Mark failed startup or stop beside the affected preset with a direct Logs
  action filtered to that preset's errors; keep technical details in logs and
  clear the failure when retrying. Retain source and level filters in the URL.
  Group log sources into Presets, Packages, Infrastructure and Runtime.
  Preset log selection includes its members and orchestration diagnostics.
  Offer Start seed packages in Access token to start the four seed providers,
  preserving other running packages and watch choices. Keep infrastructure,
  manual seed and token generation separate.
  Show current package readiness and seeded data with checkmarks on their action
  buttons. Disable startup when every required package is running and disable
  seed when the local data is already present. Restore each action when its
  current readiness becomes false.
  Packages opens a persistent seed group filter that includes all members even
  when they are running. Logs opens
  the seed package sources together with orchestration diagnostics.
  Keep manual seed in Access token, with inline progress, compact failures and
  refreshed tenant/user selection after success. Show the exact seed package
  names and a reload icon beside the Local access token title. Keep Packages and
  Logs styled like Start seed packages, with Seed local data last. Report manual reload
  results through a bottom-right snackbar, prevent concurrent requests and wait briefly
  before allowing another manual refresh. Use the
  standard Terminal and Logs button for failure diagnostics. Keep seed out of local preset
  controls. The frontend launcher requests seed explicitly during fullstack startup.
  Dialogs open with a brief animation
  that respects reduced-motion preferences.
- Keep preset section headings smaller than the page title, with clear separators
  between sections and presets. Shared presets are Frontend backend and Tenant Seeding.
- Logs uses Source, Level and Search. Search includes correlation IDs in metadata.
  Keep the line count badge sized to its text.
  Offer per-row message copy on hover, always visible on touch devices. Centre it
  vertically, fade it in and out briefly, and do not retain visibility after focus.
  Keep its space reserved so the log text does not shift. Correlation ID
  copy remains beside the ID. Report copy success or failure through a snackbar.
  Offer All packages and Infra sources for their respective aggregate streams.
  Preserve the mounted log viewport and focus while filters load, mark the previous
  snapshot as updating and disable export until the new filter's results arrive.
- Keep copy short and actionable.
  Use the ShadCN Sonner adapter for bottom-right notifications, with a neutral
  card surface, PDND typography and standard outline icons. Avoid coloured toast
  backgrounds. Keep the close button inside the notification; notifications support
  both manual and automatic dismissal.
- Compose routed pages from shared ShadCN components and keep API, query,
  mutation and interaction logic in focused modules. Keep tests separate from
  production components. Avoid global CSS aliases for component layout.
  Use React Router's route configuration, RouterProvider and Links, a shared Axios
  instance, and React Query service/query/mutation modules as in the PDND frontend.

## Typography & Layout

Use PDND's Titillium Web at 300, 400, 600 and 700, and DM Mono at 400 for code
and logs, from the same Fontsource files imported by `@pagopa/mui-italia`.
Serve fonts locally with their SIL Open Font License notices. Keep the PDND
light palette. Use a persistent sidebar on desktop and compact navigation on
mobile. Fill the viewport width, keep the header and navigation visible, and
scroll the page content independently. Give log entries the remaining viewport
space.
Use primary blue for active navigation and subtle blue for secondary controls.
Keep form controls on white surfaces with a thin blue border and translucent
focus ring. Use PDND success and warning colours with readable darker text.
Use regular weight for package names, counts and log service names; reserve
stronger weights for headings and control labels.
Use regular weight for sidebar navigation labels.

## Accessibility & Inclusion

Use labelled controls, keyboard-accessible dialogs, visible focus and text
alongside status colours. Respect reduced motion. Preserve readable logs and
usable tables on smaller screens. The agreed theme is light only.
