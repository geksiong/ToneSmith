# ToneSmith Guitar Lab: Boutique Luthier UX & Minimalist Architecture Plan

A comprehensive design and architectural overhaul that transforms ToneSmith from a crowded multi-panel tool into an elegant, intuitive boutique luthier workbench. The new UX introduces a unified top app bar with structured menus, a focused single-view inspector, a compact searchable component palette, and non-intrusive contextual canvas controls—delivering maximum working cavity space while preserving all deep guitar circuit simulation, Bode plots, real-time audio playback, and BOM export features.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX choices have been confirmed through user clarification:
>
> - **Aesthetic Direction**: **Warm boutique luthier workbench aesthetic** featuring rich walnut/ebony dark tones, warm brass/amber accents, tactile brushed brass hardware cues, and refined typography.
> - **Header Navigation**: **Unified top app bar** with structured dropdown menus (**File**, **Presets**, **Tools**, and **View**), eliminating cluttered icon buttons from the main bar.
> - **Right Inspector**: **Single active view per tab** (showing *only* Circuit Analysis, Bode Plot, Audio Lab, or Technician Notes), freeing up screen real estate and preventing vertical scroll fatigue.
> - **Left Component Palette**: **Compact searchable list** with category filters (Pickups, Pots, Switches, Passives, Hardware) and clean, quiet hover cards instead of bulky badge sandwiches.
> - **Cavity Canvas Controls**: Floating elements are unified into a sleek, docked bottom-center status & tool capsule with contextual wire color swatches appearing *only* when a wire or lug is active.

---

## 1. Overview & Core Concept

- **What It Does**: ToneSmith is an interactive physical guitar wiring simulator, schematic builder, frequency analyzer, and audio audition sandbox. Users drag vintage and modern pickups, potentiometers, capacitors, output jacks, and switches onto an authentic shielded guitar cavity, connect color-coded cloth push-back wires lug-to-lug, and immediately inspect real-time circuit impedance, DC resistance, cutoff frequencies, resonant peaks, and live guitar audio.
- **Target Audience / Persona**: Guitarists, luthiers, custom guitar tech builders, and audio enthusiasts experimenting with Strats, Teles, Les Pauls, coil splits, treble bleeds, and phase switching without burning solder or risking expensive components.
- **Key Value**: Providing a clutter-free, tactile guitar workbench where the guitar cavity canvas takes center stage ($\ge 75\%$ viewport area), while analysis and audio tools remain exactly one click away in a distraction-free drawer.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Crafting & Wiring Flow**:
   - The user opens ToneSmith and sees an expansive, warm dark woodgrain cavity canvas.
   - Using the **Left Palette**, they search or click an icon category (e.g. *Pickups* $\to$ *Humbucker PAF 4-Conductor*). A streamlined tile is dragged/clicked onto the cavity.
   - Clicking a lug initiates wire routing with a golden guide tether. Clicking a target lug completes the solder connection with instant audible/visual snap.
   - When a wire is selected, an organic mini-palette appears floating directly near the wire or in a dedicated compact toolstrip, enabling instant gauge/cloth-color reassignment.

2. **Audition & Tone Testing Flow**:
   - The user toggles to **Interactive Mode** or opens the **Audio Lab** tab in the right inspector.
   - The right panel opens to a focused, single-purpose tube amplifier & DI looper console (clean strat riff, blues lick, humbucker lead, mic input) without being pushed down by lengthy diagnostic tables.
   - The user turns physical knobs on the canvas (Volume, Tone) or flips switch positions directly on the guitar cavity, hearing instant real-time equalization changes processed via Web Audio DSP biquad filters.

3. **Circuit Verification & Bode Analysis**:
   - Switching to the **Bode Plot** tab presents an uncluttered, high-resolution frequency response graph displaying resonant frequency (Hz), peak boost (dB), and -3dB roll-off without stacked redundant panels.
   - The **Analysis** tab displays circuit state (active pickups, phase alignment, DC resistance, tone load, ground loop warnings).

4. **Project Management & Export**:
   - The **File** menu provides clean actions: *New Circuit (Clear)*, *Import JSON*, *Export Schematic*, and *Bill of Materials (BOM)*.
   - The **Presets** menu opens a visual gallery of standard wiring schemes (Modern Strat SSS, 50s Les Paul HH, Telecaster 3-Way & 4-Way, Jimmy Page 21-Tone, Bass, etc.).

### Visual Identity & Theme

- **Aesthetic**: Warm Boutique Luthier Workbench. Evokes high-end hand-wired tube amps, custom luthier workbenches (oiled walnut, brass hardware, vulcanized fiberboard bobbins, tweed accents).
- **Color Palette**:
  - `Canvas Canvas / Void`: `#121110` (deep oiled ebony/charcoal) with subtle luthier grid.
  - `Cavity Surface`: `#1c1917` (warm stone/shielded copper-lined cavity interior) with brass/copper perimeter grounding trim.
  - `Surfaces & Panels`: `#181513` (rich espresso walnut) with `#2c2520` hairline borders (`border-stone-800/80`).
  - `Primary Accent / Tone Gold`: `#f59e0b` / `#d97706` (warm amber varnish, brass pot shafts, glowing filament tubes).
  - `Signal Active / Nominal`: `#10b981` (clean vintage green cloth wire & active audio path trace).
  - `Warning / Out of Phase`: `#f97316` / `#ef4444` (warm copper red).
  - `Typography`: Clean, characterful editorial sans display (`Plus Jakarta Sans` / `Outfit`) paired with precision tabular mono (`JetBrains Mono` / `tabular-nums`) for electrical resistance and frequencies.

### Component Styling & Layout

- **Top App Bar**: Strict 3-zone contract:
  - *Zone 1 (Brand)*: Single wordmark `TONESMITH` in warm brass typography with a subtle vintage amber badge icon.
  - *Zone 2 (Menu Bar)*: Clean, unboxed text dropdown triggers (`File`, `Presets`, `Tools`, `View`, `About`) with zero pill enclosures.
  - *Zone 3 (Actions)*: Primary action button `Export Schematic` in warm amber, plus a sleek theme toggle and active audio playback stopper.
- **Left Palette (Component Library)**:
  - Collapsible to a 48px icon rail or expanded to a compact 260px drawer.
  - Quick search bar at top (`Search pickups, pots, caps...`).
  - Sleek horizontal icon tabs: Pickups, Pots, Switches, Tone Caps, Hardware.
  - Clean cards without badge clutter: Title, 1-line plain text spec (e.g. `8.4kΩ · Alnico II · 4-Conductor`), and a quiet `+ Add` hover action.
- **Center Canvas**:
  - Uncluttered canvas area.
  - Floating bottom pill: Zoom controls (`- 100% + Reset`), Mode toggle (`Edit` vs `Interactive Play`), and Signal Path Trace toggle (`Signal Path`).
  - Contextual wire color bar: only appears when a wire is selected, styled as a neat inline brass-framed swatch bar.
- **Right Inspector (Analysis & Audio Lab)**:
  - Width: 380px (reduced from 460px to give 80px more space to the canvas).
  - Header: Segmented tab bar (`Analysis`, `Frequency`, `Audio Lab`, `Notes`).
  - Body: **Strictly single-view**—clicking `Audio` renders *only* the audio player and tube amp controls; clicking `Frequency` renders *only* the Bode plot. No scrolling through 3 duplicate panels!

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-off |
| :--- | :--- | :--- |
| **Header Cleanliness** | Grouped Dropdown Menus (`File`, `Presets`, `Tools`) | Consolidates 10+ scattered buttons into standard, predictable desktop menus; keeps all features instantly accessible without visual clutter. |
| **Right Panel Density** | Strict Single-Active Tab View | Stacking all three panels (Analysis + Bode + Audio) caused vertical scroll clutter and performance overhead. Single-tab focus lets users concentrate on one task at a time. |
| **Palette Organization** | Compact Searchable List + Category Rail | Replaces heavy nested cards and multi-colored badges with clean typographic rows and live instant filtering. |
| **Canvas Floating Controls** | Unified Bottom Pill Dock | Consolidates floating buttons from top-right, bottom-left, and center-top into a single floating control capsule. |
| **Color Scheme** | Boutique Luthier Dark Palette | Warms up cold gray/zinc into a tactile artisan aesthetic matching real vintage guitar electronics, copper foil shielding, and cloth wiring. |

---

## 4. Technical Architecture & System Layout

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TONESMITH APP BAR                                  │
│  [Logo ToneSmith]   [File ▾]  [Presets ▾]  [Tools ▾]  [View ▾]    [Export] [Theme] │
├───────────────┬─────────────────────────────────────────────────┬───────────────┤
│  COMPONENTS   │              GUITAR CAVITY CANVAS               │   INSPECTOR   │
│  PALETTE      │                                                 │               │
│               │  ┌───────────────────────────────────────────┐  │ [Analysis]    │
│ [Search...  ] │  │  Shielded Guitar Cavity (Copper/Wood)     │  │ [Frequency]   │
│ [Icons: 🎸🎛️⚡] │  │                                           │  │ [Audio Lab] * │
│               │  │  [PAF Neck] ──(Wire)──┐                   │  │ [Tech Notes]  │
│ • Strat Single│  │                       ▼                   │  ├───────────────┤
│ • Tele Bridge │  │  [PAF Bridge] ──── [5-Way Switch]         │  │ Focused View: │
│ • CTS 500k Pot│  │                       │                   │  │ Tube Amp Sim  │
│ • Orange Drop │  │                       ▼                   │  │ DI Looper     │
│ • Switchcraft │  │                 [Output Jack]             │  │ Audio Stream  │
│               │  └───────────────────────────────────────────┘  │ Latency / Mic │
│               │                                                 │               │
│ [Collapse ◀]  │      [  - 100% + │ Reset │ ⚡ Path │ 🎮 Play  ]   │ [Collapse ▶]  │
└───────────────┴─────────────────────────────────────────────────┴───────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
           Circuit Engine & Solver             Web Audio DSP Engine
         (DC Resistance, Signal Path,        (Real-time Biquad Filters,
           Resonant Peak, Impedance)            DI Samples & Mic Input)
```

### Component Structure & File Refactor Plan

1. **`src/components/Toolbar.tsx`**:
   - Refactor into a clean desktop menu bar.
   - Implement dropdown menus using accessible, styled flyout menus:
     - **File**: *New / Clear Cavity*, *Import JSON*, *Export Schematic & BOM*, *Print*.
     - **Presets**: Direct dropdown list of curated guitar schematics (Stratocaster, Telecaster, Les Paul, etc.) plus *Browse All Presets...* modal trigger.
     - **Tools**: *All Switching Combinations Report*, *Technician Notes*, *Color Code Reference Guide*.
     - **View**: *Toggle Signal Path*, *Interactive Play Mode*, *Reset Canvas View*, *Theme*.
   - Keep right-hand primary CTA for instant `Export Schematic` and `Audio Stop` indicator.

2. **`src/components/ComponentLibrary.tsx`**:
   - Add clean live text search bar (`searchQuery`).
   - Refactor category switcher into a sleek icon/text segmented bar.
   - Replace bulky `LibraryItemCard` with clean, anti-slop rows: item title, unboxed specs (`8.2kΩ · Alnico V`), and hover `+` button.
   - Add a subtle popover or preview tooltip on hover for deeper wiring instructions.

3. **`src/App.tsx` & Right Inspector**:
   - Change right inspector tab rendering to **single-view**:
     - `analysis` $\to$ `<CircuitAnalyzer />`
     - `frequency` $\to$ `<FrequencyResponsePlot />`
     - `audio` $\to$ `<AudioPanel />`
     - `notes` $\to$ `<TechnicianNotesPanel />`
   - Adjust width from 460px to 380px for a more spacious central canvas.
   - Keep right sidebar collapsibility with clean vertical icon tabs.

4. **`src/components/Canvas.tsx`**:
   - Modernize the floating bottom controls into a unified glass pill dock (`Zoom`, `Reset`, `Signal Path`, `Interactive Mode`).
   - Move wire color options into an elegant contextual floating pill that appears directly when a wire is selected, preventing screen clutter when nothing is selected.
   - Refine cavity styling with warm copper shielding and walnut wood textures.

5. **Visual Styling Tokens (`src/index.css`)**:
   - Define boutique luthier CSS variables for warm stone, brass, copper, and amber surfaces.
   - Ensure seamless dark/light theme support with crisp borders and zero blurry shadow slop.

---

## 5. Verification & Quality Assurance

- **Zero Regression Verification**: Ensure all existing presets (Stratocaster, Telecaster, Les Paul, H-S-S, P-Bass, etc.) load flawlessly.
- **Audio & Signal Path Trace**: Verify interactive pot knobs, switch positions, DI guitar playback, and signal path highlighting remain 100% reactive.
- **Export & Notes**: Verify JSON import/export, PNG schematic generation, BOM tables, and saved technician notes function properly.
- **Build Verification**: Run `compile_applet` to confirm zero TypeScript, lint, or JSX compilation errors.
