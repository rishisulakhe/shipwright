# UI Implementation Specification: Centralized Docker Management Dashboard

## 1. System Overview & Core Stack
You are building the frontend interface for a centralized, multi-host Docker management platform modeled closely after Portainer. The implementation must look production-ready, clean, data-dense, and highly performant.

**Tech Stack:**
- **Framework:** React (with TypeScript)
- **Styling:** Tailwind CSS (Dark Mode optimization default)
- **Component UI Library:** shadcn/ui (Radix Primitives)
- **Icons:** Lucide React

---

## 2. Global Theme & Aesthetic Guidelines
The UI must mirror a professional cloud infrastructure dashboard:
- **Color Palette:** Slate/Zinc-heavy dark theme.
  - Background: `bg-zinc-950` or `bg-slate-950`
  - Sidebars/Cards: `bg-zinc-900` / `bg-slate-900` with subtle borders (`border-zinc-800`)
  - Accent Primary: Tailwind Blue (`bg-blue-600`, `hover:bg-blue-500`) or Teal.
- **Typography:** Monospace/Sans hybrid feel. Use clean sans for navigation (`Inter` or system-sans) and clean tabular figures (`font-mono`) for metrics, resource IDs, IP addresses, and status timestamps.
- **Layout Consistency:** Use a fixed sticky layout. The sidebar and top navbar stay fixed; only the inner content region scrolls.

---

## 3. High-Fidelity Screen Wireframes

### Screen A: Environment Selector (Home Screen)
This is the root landing layout where users view and pick their connected Docker Daemons.

#### Layout Topology:
1. **Top Navigation Bar:**
   - Left side: Logo/Branding placeholder + App Name.
   - Right side: System Notifications (bell icon), Help Center, and User Profile dropdown menu (`admin`).
2. **Main Workspace Container:**
   - Single layout with a localized banner greeting showing system news or platform updates.
   - **"Environments" Section Header:** Includes a search bar input (`Search by name, group, tag, status...`) and a manual "Refresh" button.
3. **Environment List Matrix:**
   - Render a vertical list of large cards representing active connections.
   - **Card Architecture:**
     - Left edge: Large visual icon representation of the engine type (e.g., a styled Docker Whale logo).
     - Text info Block: Environment name (e.g., `local`), status badge (`UP` in emerald-600 green with light green pulsing text), and connection timestamp.
     - Metrics Inline Strip: Small inline row indicating hardware aggregates: `X stacks`, `Y containers`, `Z volumes`, `W images` followed by CPU/RAM allocations.
     - Right edge: Connection protocol endpoint string (e.g., `Standalone` / `/var/run/docker.sock`).

---

### Screen B: Infrastructure Portal (The Main Sidebar Layout)
Once a user clicks on an environment (e.g., `local`), they enter the core workspace view.

#### Layout Topology:
1. **Left Primary Navigation Sidebar (Fixed Width, `w-64`):**
   - **Environment Context Indicator:** A distinct, highlighted block box at the top showing the currently selected environment (e.g., `local` with an active cross button to disconnect back to Screen A).
   - **Contextual Menu Links Groups:**
     - **Dashboard:** Overview telemetry metrics.
     - **App Templates:** Curated deployment catalogs.
     - **Stacks:** Multi-container docker-compose groupings.
     - **Containers:** (Active selection highlight) Data table tracking workloads.
     - **Images / Networks / Volumes:** Core storage and communication sub-layers.
     - **Host:** Physical engine performance data.
   - **Footer Meta-Group:** App version labels and global action buttons (Settings, User Access).

2. **Inner Container Workspace (The Resource Control Board):**
   - **Context Path Header:** Small path links indicating current position (`Containers > Container List`). Includes a spin-refresh toggle icon directly next to the header text.
   - **Global Actions Dashboard Strip:** A row of unified control inputs immediately above the primary dataset:
     - Multi-Select check actions: `Start`, `Stop`, `Kill`, `Restart`, `Pause`, `Resume`, `Remove`.
     - Primary Call to Action: `+ Add container` positioned prominently on the right.
   - **High-Density Dense Data Table:**
     - Standard columns matching the exact database schemas:
       1. **Checkbox Selector (`[ ]`):** Bulk operations hook.
       2. **Name:** Container name string rendered as an underline action link.
       3. **State:** Rounded micro-badge containing state rules (e.g., Running uses emerald green fill text; Exited/Stopped uses a muted scarlet/red fill).
       4. **Quick Actions:** Small row of fast-access icon buttons: See Logs (`io.Reader` terminal icon), Realtime Stats (graph icon), Interactive Console TTY (`>_` icon).
       5. **Stack:** Parent configuration reference (if null, display a simple `-`).
       6. **Image:** Source tag descriptor (e.g., `postgres:16-alpine` link).
       7. **Created At:** Clean relative or timestamp text.
       8. **IP Address & Published Ports:** Network details mapped out dynamically (e.g., `172.20.0.4`, `8080:8080` link).
       9. **Ownership:** Multi-tenant access controls marker (`administrator` / `developer`).

---

## 4. Interaction Requirements & State Management Rules

- **Interactive Hover-States:** All actionable data table items (such as image layers, container names, and port endpoints) must trigger subtle highlight changes or tooltips on hover.
- **Inline Action Logic:** Clicking a container name link or quick action icon must switch the application layout view instantly or pull up the corresponding WebSockets pipeline overlay (e.g., connecting a live interactive shell).
- **Responsive Overflow Scaffolding:** Tables must allow horizontal scrolling internally on small displays without breaking the grid alignment of the sidebar or top navigation bars.

---

## 5. Implementation Instructions for the Agent
1. **Component Modularization:** Separate the layout into a `Sidebar`, a `Header`, and reusable data tables with shadcn/ui `<Table />` primitives.
2. **State Scaffolding:** Create mock data matching the exact schema payloads (`User`, `DockerHost`, `Container`, `Network`, `Volume`, `Image`) so that changing an active environment smoothly updates the entire workspace tree.
3. **Tailwind Class Usage:** Prioritize clean, low-contrast border boundaries, flat uniform backgrounds, and precise tabular tracking values (`tracking-tight`, `font-mono` for metrics).