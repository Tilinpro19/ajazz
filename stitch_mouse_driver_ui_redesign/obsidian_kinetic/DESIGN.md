---
name: Obsidian Kinetic
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#b9cbbd'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#849588'
  outline-variant: '#3b4a40'
  surface-tint: '#00e293'
  primary: '#cdffde'
  on-primary: '#003921'
  primary-container: '#00f5a0'
  on-primary-container: '#006b43'
  inverse-primary: '#006c44'
  secondary: '#a5e7ff'
  on-secondary: '#003543'
  secondary-container: '#00d2ff'
  on-secondary-container: '#00566a'
  tertiary: '#fff0f0'
  on-tertiary: '#670020'
  tertiary-container: '#ffcace'
  on-tertiary-container: '#bb0041'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#50ffaf'
  primary-fixed-dim: '#00e293'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005232'
  secondary-fixed: '#b6ebff'
  secondary-fixed-dim: '#47d6ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004e60'
  tertiary-fixed: '#ffd9dc'
  tertiary-fixed-dim: '#ffb2ba'
  on-tertiary-fixed: '#400011'
  on-tertiary-fixed-variant: '#910030'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: '0'
  body-lg:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system defines a precision-engineered control surface built for competitive esports athletes, performance overclockers, and gaming enthusiasts. It treats hardware companion software not as an auxiliary utility, but as a calibrated instrument of performance.

The visual style synthesizes **Technical Glassmorphism** with **Engineered Minimalism**:
- **Tactile Calibration:** The interface feels like military-grade avionics mixed with high-end carbon composite hardware. Surfaces are matte obsidian, punctuated by ultra-fine optical cyan and electric emerald illuminations.
- **Micro-Precision Feedback:** Every interaction responds with zero-latency visual confirmation. Sub-pixel strokes, glowing micro-indicators, and exact readout telemetry give users raw control over hardware polling rates, sensor lift-off distances, DPI matrix stages, and low-latency debounce timings.
- **Focused Restraint:** Emitting illumination is functional, not decorative. Glows are concentrated strictly around active telemetry states, primary action thresholds, and key switch activations to preserve visual acuity in low-light tournament environments.

## Colors

The system operates strictly in dark mode, optimizing OLED and high-refresh-rate monitor contrast while preventing eye strain.

### Functional Palette Logic
- **Primary (`#00F5A0` Electric Emerald):** Dictates active telemetry, enabled switches, hardware sync status, and primary operational triggers. It denotes optimal, low-latency performance.
- **Secondary (`#00D2FF` Hyper Cyan):** Reserved for sensor coordinates, secondary profile assignments, modifier binds, and optical DPI stage indicators.
- **Tertiary (`#FF3366` Voltage Red):** Restricted to high-consequence actions, firmware flashes, destructive profile resets, and sensor warning thresholds (e.g., critical low battery or packet drop).
- **Neutral Core (`#0B0F17` Obsidian Void):** The foundational substrate. Elevated sub-surfaces scale through `#111827` (Slate Canvas), `#1A2234` (Surface Raised), and `#222F46` (Border/Divider Highlight).

### Illumination & State Modifiers
- **Telemetry Glow:** Active states utilize pure primary/secondary tones blended into the border with a box-shadow drop of `0 0 12px rgba(0, 245, 160, 0.28)`.
- **Text Hierarchies:** High-contrast text uses `#F3F4F6` (95% light), muted operational text uses `#94A3B8`, and disabled/read-only metrics drop to `#475569`.

## Typography

Typography balances ergonomic legibility with raw engineering telemetry.

- **Primary Interface Font (Geist):** Clean, neutral, high-density neo-grotesque handling structural navigation, module titles, system states, and instructional body copy.
- **Telemetry & Metric Font (JetBrains Mono):** Drives raw numbers, hex parameters, Hz rates, battery percentages, millisecond debounce measurements, and axis indicators. Every numerical change renders without proportional layout jitter due to its tabular monospace geometry.
- **Casing & Metrics:** All micro-labels (`label-sm`, `label-md`) must be styled with uppercase styling and expanded tracking for instant glanceability under rapid competitive switching.

## Layout & Spacing

This design system uses a dense, desktop-first telemetry grid engineered to maximize screen estate without cognitive clutter.

### Grid & Layout Structure
- **Frame Archetype:** Fixed-ratio or responsive multi-pane driver window (minimum desktop target: 1024x720, default canvas: 1280x860).
- **Navigation Spine:** 64px collapsed icon rail or 220px fixed telemetry rail on the left.
- **Main Canvas:** 12-column modular grid with `0.75rem` (12px) gutters and `1rem` (16px) margins.
- **Telemetry Shell:** Modular widgets lock onto a 4px/8px incremental base grid. Component cards stack vertically or pair into symmetrical 6-column telemetry groups (e.g., DPI stage matrix paired alongside Sensor Angle Snapping/LOD).

### Responsive Reflow Rules
- **Desktop Expanded (>1200px):** 3-column split view (Left: Profile Selector & Hardware Tree, Center: Mouse 3D Interactive Wireframe / Sensor Map, Right: Real-time Telemetry & Performance Tuners).
- **Desktop Compact (1024px–1199px):** 2-column view (Left: Hardware Interactive Viewer, Right: Tabbed Performance Controls).
- **Micro-HUD Overlay Mode (<600px):** Floating single-column widget displaying active DPI, battery percentage, and rapid profile switcher.

## Elevation & Depth

Visual hierarchy uses **Glassmorphism layered on low-contrast structural outlines**. Shadows are minimized in favor of selective luminant borders and dark atmospheric layering.

### Depth Stack
1. **Root Canvas (`#0B0F17`):** Flat, deep obsidian background with a subtle ambient radial gradient (`rgba(0, 210, 255, 0.03)` positioned at the center top).
2. **Modular Containers (`#111827` at 70% opacity):** Frosted glass backdrops with `backdrop-filter: blur(16px)` and a crisp 1px stroke of `rgba(255, 255, 255, 0.07)`.
3. **Interactive Sub-surfaces / Inputs (`#1A2234` at 90% opacity):** Inset surfaces with a 1px border of `rgba(255, 255, 255, 0.12)`.
4. **Focused & Active Modals:** Elevated to `#1E293B` with a multi-layered ambient glow:
   - Outer glow: `0 0 24px rgba(0, 245, 160, 0.15)`
   - Rim highlight: `1px solid rgba(0, 245, 160, 0.5)`
   - Occlusion drop shadow: `0 16px 32px -8px rgba(0, 0, 0, 0.65)`

### Light Edge Inset
Interactive modules employ a 1px internal pseudo-border on top edges (`border-top: 1px solid rgba(255, 255, 255, 0.1)`) simulating directional chamfered CNC aluminum or hardened poly-carbonate.

## Shapes

The geometric signature uses **Soft Precision (`roundedness: 1`)**. 

- **Containers & Master Cards:** `0.5rem` (8px / `rounded-lg`). Provides tight containment without looking circular or playful.
- **Interactive Controls (Buttons, Inputs, Segments):** `0.25rem` (4px / base). Sharp, purposeful corners reflecting surgical precision instrumentation.
- **Status Pills & Channel Markers:** Small metrics badges and active connection indicators use an exception token of `9999px` (full pill) to differentiate dynamic status flags from structural modules.

## Components

### Buttons
- **Primary Action (Calibration/Save):** Background of `#00F5A0`, text in `#0B0F17` (`label-md` font weight 600). Hover produces `box-shadow: 0 0 16px rgba(0, 245, 160, 0.45)`. Active press reduces scale to `0.98`.
- **Secondary / Ghost (Profile Duplication, Bind Clearing):** Transparent background, 1px border of `rgba(255, 255, 255, 0.14)`, text in `#F3F4F6`. Hover triggers `border-color: #00D2FF` and text color `#00D2FF`.
- **Destructive:** Border and text in `#FF3366`. Hover fills background with `rgba(255, 51, 102, 0.15)`.

### Precision Sliders (DPI, LOD, Debounce)
- **Track:** 4px height, background `#1A2234`, rounded-sm. Active range track filled with gradient `linear-gradient(90deg, #00D2FF 0%, #00F5A0 100%)`.
- **Thumb:** 14px x 14px vertical chamfered rect or diamond, `#F3F4F6` with a central dot of `#0B0F17`. On drag, thumb casts a `0 0 10px #00F5A0` bloom and renders a floating `label-sm` numerical readout tool-tip above.

### Tactile Segmented Controls (Polling Rate: 125Hz / 500Hz / 1000Hz / 4000Hz / 8000Hz)
- Enclosed in an obsidian recessed pill (`#0E1420` with 1px `rgba(255, 255, 255, 0.05)` border).
- Active item snaps into place with a 1px border of `#00F5A0`, background `#1A2836`, and emerald glow. Typography shifts from muted `#64748B` to `#00F5A0`.

### Input Fields & Value Counters
- Built for fast numerical keyboard input or incremental scroll-wheel scrubbing.
- Background `#111827`, border `1px solid rgba(255, 255, 255, 0.1)`. Focus state illuminates a sharp `1px solid #00D2FF` with zero outline offset.
- Suffix units (`ms`, `DPI`, `Hz`, `mm`) rendered in `label-sm` muted `#64748B`.

### Telemetry Cards & Hardware Visualizer
- **Cards:** Modular frosted glass containers containing header bars with `label-md` uppercase labels, icon slots, and active parameter values.
- **Status Indicators:** Micro 6px circular nodes. Green (`#00F5A0`) pulsing at 2-second intervals for 2.4GHz wireless connected, static for wired USB-C, Cyan (`#00D2FF`) for optical pairing, and amber/red for battery critically low (<15%).
- **Interactive Mouse Map:** SVG/Canvas wireframe mouse schematic occupying center canvas. Bindable nodes are anchored via fine 1px polyline callouts linked to high-density dropdown tags.