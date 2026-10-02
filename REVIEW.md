# Dock active state: review

## Root cause
1. The lit tab was the `tab` state in `Shell.tsx`, set only by `selectTab` (dock/rail/avatar/Esc) and a few `setTab('city')`.
   Every other path changed the screen without touching it and left it stale: the HUD cash chip (bank.show), work-in-progress
   slots (job.status, education.list), toasts and events, the village menu, back, resumed deep links. Example: from the profile
   tab, tapping the cash chip opened the bank while the profile tab stayed lit.
2. The centre tab always drew the full gold `.v6-disc`, so the village looked selected on every screen.
3. The other tabs' only cue was a label colour, too weak to see.

## Fix
- `Shell.tsx`: `tabOfScreen(screenKey)` derives the tab from the screen shown (hub locals, village/world locals, command
  family table). Screens in no single tab (and commands that live in two, like work.home) keep the last tab. `tab` is now
  that derived value, and the state is synced from it so `rootOf`/`atRoot`/back keep working.
- `v6.css`: active tab gets a lit plate, raised glowing icon, gold label and a gold indicator bar; inactive icons are dimmed;
  the centre medallion keeps its shape but has its gold ring and glow only when the place tab is active (desaturated grey ring
  otherwise). Desktop rail: active section plate with gold edge, dimmed others, lit sub-item with outline.
- `parts.tsx`: `aria-current` on rail section buttons and sub-items; dock keeps `aria-current="page"`, and the `dock-bar`, `dock-tab`, `dock-label` classes.

## Checked
Mock mode, 390x844 and 1440x900: each tab, economy -> bank, HUD cash chip from the profile tab (now lights economy), back to
home. Shots in `torncity-lab/tools/pwn/shots/dockfix/` (script `tools/pwn/dockfix.js`).

## Follow-up: stale look on the previous tab
In a shot the gold bar and plate appeared on the previous tab as well as the active one. The state was right (`aria-current` on one tab only); the
cause was the .15-.18s CSS transitions on the dock tabs, caught frozen mid-way when the page renders slowly (software 3D). The transitions are removed,
so the dock is always drawn in its final state, and `:focus:not(:focus-visible)` clears any tap outline. Reshot all phone shots; each shows exactly one lit tab with its bar above it.
