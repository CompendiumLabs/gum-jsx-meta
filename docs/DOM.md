# Retained DOM rendering and interactive Gum

Status: roadmap with initial implementation progress, updated 2026-10-20.
API names in unimplemented phases remain provisional.

## Initial implementation

Phase 1 is implemented: the React adapter retains converted source elements,
ignores unchanged reconciled children, applies root configuration with children in
one update, and exposes layout fragments and per-render counters. Core now bounds
query and preparation caches for long-lived elements. Focused contracts and the
React, core, and Maps package checks verify the new behavior.

Phase 0 has a [small browser example](../gum-jsx-react/example/README.md) and
[initial headless measurements](../gum-jsx-react/test/results/retention.md).
It uses deterministic synthetic tracks over offline geography. The production
bundle builds and the scene has been rasterized and visually checked. Browser
interaction/paint measurements, a sustained browser run, and real Deadlift trace
fixtures remain baseline follow-ups. The SVG string backend remains in use;
retained DOM rendering begins in phase 2.

The source findings below describe the starting implementation before these changes.

## Direction

Make `@gum-jsx/react` a practical host for continuously updated, interactive Gum
figures. Use Deadlift's trace viewer as the first application: geography, moving
units, labels, selectable trails, and a playback timeline. The application should
exercise Gum's rendering path for the scene, so its performance improvements also
benefit other Gum users.

Keep the existing separation between immutable source elements, layout, and
immutable fragments. Add retained SVG DOM output in the React package, reusing
React DOM for reconciliation. Preserve unchanged source elements and fragments
through updates. Extend core only where information must survive layout or where
multiple output backends need the same pure operation.

Skipping SVG markup is useful, but it is only one part of this work. A DOM backend
still formats SVG path `d` attributes, builds or reconciles nodes, and incurs
browser style and paint costs. The goal is to avoid repeating unchanged work
throughout the pipeline, with measurements for each stage.

## What the implementation already provides

| Area | Current behavior | Consequence |
| --- | --- | --- |
| React host tree | The custom reconciler retains `GumHostInstance` objects and ordered children. | React has already established source identity; use these instances as the basis for reuse. |
| Source conversion | `instanceToGum` recursively constructs new core elements on each dirty-root render. | A retained React component currently does not imply a retained core element. |
| Layout | One `LayoutPass` persists per React root; its caches use `Element` identity and query inputs. | Reconstructing elements defeats most cross-frame layout reuse. |
| Root updates | Size, theme, props, output options, and children can each flush separately. | One React update can produce intermediate layouts and output. |
| Output | `renderContainer` calls `render_element`; `<Gum>` assigns its SVG string to `host.innerHTML`. | The browser recreates the scene's DOM instead of retaining its nodes. |
| Core boundary | `layout_element`, `Fragment`, `Drawing`, and `prepare_render` are public already. | A new renderer can consume in-memory fragments without inspection JSON or a new layout API. |
| Output preparation | `prepare_render` lowers debug metadata to drawings; text mode is selected during layout. | Reuse this operation, but do not describe it as text shaping or font loading. |
| Fragment identity | A fragment can have several placements; placements carry offset and transform. | Fragment object identity alone cannot identify a DOM occurrence. |
| Maps | `GeoMap.layout` projects geography and lays out overlays together. | Changing one child can reconstruct the map and regenerate all base paths. |
| Resource invalidation | Changing a resource invalidates the whole pass. | Playback time and camera state should not be updated as global pass resources every frame. |
| Cache lifetime | Each retained element can accumulate a map of distinct query results. | Keeping elements alive makes continuous resize and camera workloads a memory concern. |

Source references: [React runtime](../gum-jsx-react/src/runtime.ts),
[reconciler](../gum-jsx-react/src/renderer.ts),
[DOM host](../gum-jsx-react/src/canvas.tsx),
[layout pass](../gum-jsx-core/src/engine/pass.ts),
[fragment types](../gum-jsx-core/src/engine/fragment.ts),
[layout entry points](../gum-jsx-core/src/render.ts),
[output preparation](../gum-jsx-core/src/engine/output.ts), and
[GeoMap](../gum-jsx-maps/src/map.ts).

[PERF.md](PERF.md) already identifies SVG number formatting, outlined text, and
map preparation as meaningful costs in historical export measurements. Those
measurements motivate stage-level profiling; they do not predict browser frame
rates or the savings from a DOM backend.

## Package boundaries

| Responsibility | Owner |
| --- | --- |
| Convert React host instances into retained immutable core elements | `gum-jsx-react` |
| Batch root updates, publish committed scene snapshots, manage browser lifecycle | `gum-jsx-react` |
| Convert fragments to React SVG nodes, retain DOM definitions, attach events and refs | `gum-jsx-react` |
| Browser font registration and readiness | `gum-jsx-react`, initially reusing the editor's approach |
| Layout, drawing geometry, clipping, fitting, source snapshot semantics | `gum-jsx-core` |
| Minimal identity/provenance that must survive layout | `gum-jsx-core`, with React assigning host identities |
| Shared path/shape output helpers and bounded layout caching, where required | `gum-jsx-core` |
| Prepared geographic views, reusable projected geometry, geographic visibility | `gum-jsx-maps` |
| Playback clock, trace indexing, selection, controls, camera gestures, geographic assets | Deadlift `viz` |

Do not introduce React, DOM nodes, event functions, browser globals, or animation
scheduling into core. Keep mutable browser state in the adapter. Keep simulation
and replay policy in Deadlift. Introduce another DOM package only if an actual
non-React consumer or a measured rendering bottleneck warrants it.

## Target pipeline

```text
React scene + application state
    ↓ custom reconciler
retained Gum host instances + adapter-owned event bindings
    ↓ reuse unchanged conversions
immutable core elements
    ↓ shared LayoutPass
immutable fragment snapshot + occurrence identity
    ├─ prepare_render → React SVG components → React DOM
    └─ prepare_render → SVG/export backend, when requested
```

The first DOM backend should produce ordinary React SVG elements. It should not
parse SVG strings, consume `inspect_fragment` JSON, or introduce a second general
scene description between fragments and React. React DOM owns the output nodes;
the Gum custom reconciler continues to own the authored scene.

This involves two reconciliation stages. Measure both. Start with the simpler
React DOM integration; consider an imperative patcher only if profiling shows
that React output reconciliation prevents the target workload from meeting its
budget. That alternative should consume the same fragment contract.

## Decisions to establish early

### Source reuse and update ownership

Cache each host instance's converted core element. A geometry-affecting prop,
text, constructor, or child change invalidates that conversion and the affected
ancestors; unchanged sibling conversions remain reusable. Moving a child dirties
both affected parents. Constructor-registry changes invalidate the relevant
conversions. Preserve source order and existing snapshot/validation guarantees.

Separate host-only props, such as events and refs, before core conversion. A
callback-only change should update the adapter's committed binding without
reconstructing geometry. Core currently rejects functions in ordinary source
data, which is a useful boundary to preserve.

Treat application props and data as immutable values. Do not add a deep comparison
of the entire dataset on every frame. Document that changing arrays, records, or
captured callback inputs requires a changed value or an explicit version where
the API supports one. Memoizing a callback must not leave hidden mutable state
behind a cached core element. Element-valued props and construction callbacks
need the same conversion rules as ordinary children.

The adapter must also distinguish changes to React `children` objects from actual
changes to the reconciled host child list. Fresh JSX objects alone should not
invalidate an otherwise unchanged core subtree.

### Three identities, with different jobs

1. **Source identity:** a retained React host instance. React keys preserve these
   instances across sibling reordering; the adapter should assign its own token
   to the instance instead of reading private Fiber fields.
2. **Content identity:** an immutable element, fragment, or drawing object. This
   permits conversion, layout, and output memoization while the inputs are equal.
3. **Occurrence identity:** one placement of content within a rendered parent.
   This retains a DOM node even when its content or transform changes.

Use a minimal renderer-neutral annotation for source ownership through layout,
with explicit local placement keys where content is repeated. Prefer annotating
the result at a real layout boundary over wrapping every source element in a
new layout container. A source token remains stable when its props change; its
new fragment object represents new content under the same rendered occurrence.

The exact fields should be settled by the first DOM prototype. The contract must
cover keyed sibling insert/delete/reorder, repeated placement of one fragment,
fitting wrappers, and custom elements. A reused fragment can have independent
DOM occurrences and refs. Array indices are acceptable for fixed internal drawing
slots, but cannot establish semantic identity for a changing list of units.

Do not reuse `connection.id`: it identifies targets within a Network, and has
scope and geometry semantics unrelated to DOM ownership. Do not assume that every
source element survives as a fragment: inline `Span` data and generated drawing
batches can be consumed by a parent. Initially, interaction belongs on supported
element boundaries; per-span and per-item batch interaction needs an explicit
later contract.

### Output fidelity and reuse

The DOM backend needs all current drawing kinds: rectangles (including independent
corner radii), ellipses, paths, PNG images, and live text. It must preserve drawing
order, placement transforms, opacity, nested rectangle/path clipping, viewport
clipping, debug output, and inherited text defaults.

Use shared pure helpers for SVG-specific geometry and numeric formatting where
duplication would drift. For example, `path_data` exists internally but is not
currently exported from core's main entry point. A narrowly scoped output export
is preferable to importing private files or designing a general backend framework.

Memoize immutable drawing conversion, especially path strings. Bypass unchanged
fragment subtrees when render context is unchanged. The live renderer can preserve
stable groups at ownership and placement boundaries even where the export
serializer removes empty groups. A transform changing between identity and
nonidentity must not remount its content.

Definition IDs must be unique across roots and stable across unrelated updates.
The current string serializer allocates clips by traversal order on every render;
that policy would cause unnecessary DOM churn. Allocate live definitions within
the host's lifetime, update their references coherently, and retire unused entries.
Shared content can share a clip definition while retaining separate occurrences.

Visual equivalence is the requirement; identical markup is not. Start with the
existing text modes. A direct DOM backend does not automatically make outlined
text cheap or live text correct: browser faces must match the faces Gum measured.
Reuse the approach in [editor fonts](../gum-jsx-edit/src/fonts.ts), with ownership
that supports multiple mounted figures. Fontkit loading and browser `FontFace`
readiness are separate operations. Stale asynchronous loads must not overwrite a
newer scene or revive an unmounted host.

### Commit, lifecycle, and events

Publish one coherent scene snapshot for a logical root update. Apply size, theme,
props, output configuration, and children as one transaction before layout.
Internal hook updates must publish through the same path. Event bindings and
geometry must belong to the same committed scene; speculative renders must not
change live handlers.

Use a snapshot subscription boundary between the custom root and the enclosing
React DOM tree. Publishing output must not feed it back as a new scene input or
create an update loop. Verify scheduling with the package's actual React and
`react-reconciler` versions. Avoid adding synchronous nested flushes merely to
force the two roots to appear synchronized.

A pointer-event surface should support selection, hover, dragging, wheel input,
and pointer capture, with keyboard focus on opted-in interactive elements.
Keep functions in an adapter registry and attach React handlers to output
boundaries. Let DOM event propagation govern output nesting. Source component
ancestry is not necessarily the same tree, and parent application context does
not automatically cross into the custom renderer's separate React root.

Define refs explicitly: the current reconciler returns a Gum host instance, not
an SVG element. Prefer a documented handle for an interactive occurrence rather
than exposing arbitrary internal SVG children. Hit targets should be deliberate
(for example, a wider invisible trail stroke), and interactive boundaries should
accept appropriate labels/focus metadata. Pointer capture ends normally if its
owner is removed; surviving owners should retain it across updates.

### Long-lived caches

Weak keys alone do not bound memory: a retained element's query-result map can
grow with every unique viewport size or projection. Record cache cardinality and
memory during continuous resize, zoom, scrubbing, and repeated dataset loads.

Add a bounded policy where measurements demonstrate accumulation, preserving
reuse for natural measurement and the current working set of exact offers.
Do not round layout requests to manufacture cache hits; text wrapping can change
at exact boundaries. Clear host-owned bindings, output caches, definitions, and
subscriptions on unmount. Do not clear the entire pass every frame to hide growth.

## Implementation roadmap

### 0. Establish the workload and baseline

Owners: React package and Deadlift.

- Build a small repeatable browser benchmark using a local geographic fixture,
  fixed-size moving markers, labels, and trails. Keep both a small real replay and
  a larger replay with many spawned entities. Record rows, units, visible units,
  trail segments, geographic path commands, and viewport size.
- Capture the current string/`innerHTML` pipeline before changing it. Measure
  no-op updates, one moving unit, playback, scrubbing, pan/zoom while paused,
  simultaneous playback and gestures, resize, and dataset replacement.
- Record construction, layout, projection, serialization/output conversion,
  React reconciliation/commit, DOM mutations, and browser paint separately.
  Record allocation/GC and retained memory during sustained use.
- Capture source revisions, browser/runtime versions, hardware, font readiness,
  development/production mode, and Gum freezing policy. Use production builds for
  performance conclusions and development builds for lifecycle diagnostics.

Exit: repeatable baseline and a correctness fixture, with enough detail to locate
costs. No frame-rate claim based only on Bun layout or serializer benchmarks.

### 1. Retain source elements and batch root updates

Owner: React package; core cache work only if this phase exposes growth.

- Add cached core elements and dirty propagation to host instances. Invalidate
  conversion for changed descendants and constructors while reusing other branches.
- Split host-only interaction bindings from layout props. Cache converted
  callbacks/element-valued props consistently with the documented immutable inputs.
- Add an atomic root update path and route `<Gum>` through it. Preserve intentional
  synchronous headless operations; avoid rendering intermediate option states.
- Keep output conversion separate from layout so later DOM mode can request
  fragments and headless callers can still request SVG.

Exit: a no-op update causes no element reconstruction or DOM replacement; one
changed marker retains unrelated element identities and gets layout-cache hits
where the query is unchanged. Count required parent layouts instead of promising
that a leaf update can never affect a parent. Confirm long-lived cache behavior.

### 2. Add a retained SVG DOM backend

Owners: React package, with minimal core identity/output additions.

- Start with a vertical slice: keyed circles inside transformed groups, then
  insert, reorder, move, and remove them while checking actual DOM node identity.
  Include two placements of the same fragment before finalizing the identity API.
- Switch the live path to `layout_element` and `prepare_render`, then translate
  fragments into React SVG nodes. Keep serialized SVG as an on-demand output;
  DOM updates should not serialize a shadow copy for `getSvg()` or an old callback.
- Implement all drawing kinds, stable clips/definitions, text modes, and debug
  preparation. Preserve group boundaries required for identity and interaction.
- Memoize unchanged fragment output and path formatting, accounting for renderer
  options and root-specific definitions. Handle stale attributes when a drawing's
  style or kind changes.
- Publish snapshots into the existing React DOM tree; avoid an extra DOM root per
  fragment. Check mount/unmount, Strict Mode, resize, error handling, font loading,
  and independent state updates inside the custom renderer.

Exit: browser output matches the existing renderer's geometry and visual behavior,
without markup insertion. Surviving keyed nodes retain identity. An unchanged
subtree produces no DOM mutations and does not reformat its paths. Multiple Gum
figures have independent definitions and lifecycle. Headless export still works.

### 3. Complete the interaction boundary

Owner: React package; core carries only the agreed identity metadata.

- Expose typed pointer/keyboard handlers and occurrence handles on supported Gum
  boundaries. Keep callbacks out of core element data and fragment serialization.
- Resolve events to the latest committed handler. Support explicit hit geometry,
  pointer capture, coordinate conversion through the rendered transform, and
  focus/accessible labels for opted-in controls.
- Define behavior for disappearing units, reordered children, changed callbacks,
  disabled interaction, overlapping targets, and multiple placements.
- Document the custom-root context boundary and the initial limits on interactive
  inline spans and generated mark batches.

Exit: a marker can be selected and dragged through continuous scene updates;
reordering preserves the intended target and focus; changing only a handler causes
no geometry layout; unmount leaves no listeners or retained binding registry.

### 4. Separate geographic preparation, camera, and overlays

Owners: Maps package and Deadlift, with a generic core primitive only if needed.

Source retention alone does not solve this step. Moving a child rebuilds its
`GeoMap` ancestor, whose current layout regenerates geography and creates a new
`Projection` for the child coordinate context. Prepared sources reduce parsing
and topology work, but do not by themselves retain projected base paths.

- Factor a stable geographic drawing from the container that projects and places
  overlays. Use ordinary retained composition where possible: one static geography
  child and dynamic overlay siblings sharing a prepared view. `GeoMap` can remain
  a convenience composition if useful; avoid caching an entire scene by its props.
- Provide a reusable prepared view with projection, visibility/clipping, and any
  required inverse-coordinate operation. The one-shot `project_geo_point` helper
  currently fits a projection on every call, so it should not be used once per unit
  per frame. Keep mutable D3 projection instances behind the prepared-view boundary.
- Separate geographic projection from the affine camera. Pan should generally
  update transforms; zoom should reuse geometry until a deliberate detail threshold
  requires regeneration. Moving markers should not invalidate the geographic view.
- Keep camera state in the committed scene or include it explicitly when exporting
  that scene. A fast presentation transform must not make the saved frame disagree
  with the visible frame or become an independent source of camera state.
- Keep the viewport clip fixed in screen space and generate enough geographic
  coverage for camera movement. Simply transforming a `GeoMap` clipped to the old
  viewport can reveal blank edges. Apply the same world-to-screen mapping to all
  overlays and picking.
- Put screen-sized markers and labels in a screen-space layer, or use an explicit
  equivalent composition. Scaling all SVG content also scales text and symbols;
  non-scaling strokes alone do not solve this. Reuse a label's measured content
  when only its placement changes, and derive the scale bar from the actual view.
- Keep geometry/detail caches bounded. Introduce culling or simplification only
  with explicit coverage and accuracy rules for paths crossing the viewport.

Exit: with the camera fixed, playback performs no geography projection or base-path
formatting. Paused pan reuses geography. Zoom, selection, labels, and scale agree
on coordinates, and camera motion cannot expose holes caused by stale clipping.

### 5. Port the Deadlift replay surface through Gum

Owner: Deadlift, using the React and Maps APIs above.

- Keep trace loading, frame selection, and playback controls in React. Express
  geography, unit symbols, labels, selection rings, and trails as Gum scene content.
- Preserve existing replay semantics before adding interpolation or new features.
  The current viewer is a 2D position display; altitude-aware 3D and pitched-map
  parity are separate projects.
- Index tracks once and prepare reusable projected positions for a fixed view.
  Restrict trail construction to the visible time interval. Use stable segment
  identities where trails have interactive or persistent output nodes.
- Implement time-based fading with an explicit segment/opacity policy. One
  spatial linear gradient does not reproduce time fading on arbitrary curved or
  self-crossing tracks. Measure the cost and document any approximation.
- Use local geographic assets with sufficient regional detail and recorded
  provenance. Gum's bundled 1:110m countries are an orientation layer, not a
  tactical coastline/road dataset. Asset preparation is separate from DOM rendering.
- Preserve layer toggles, click selection, enlarged hit targets, frame stepping,
  playback speeds, looping, trail length, and the statistics panels.

Exit: the existing top-down workflow runs through Gum with offline geography and
no tile-service account. Replay data and UI behavior agree with the baseline.
Deadlift remains a consumer of reusable Gum APIs, rather than maintaining a second
handwritten SVG scene renderer around them.

### 6. Optimize against the recorded budget and publish the contract

Owners: the package responsible for each measured cost.

- Compare baseline, retained conversion with string output, and retained conversion
  with DOM output. Use the same data, viewport, visual fidelity, and font mode.
- Measure median, p95, and p99 update costs, frame intervals/missed frames, input
  responsiveness, node/definition counts, and sustained memory. Distinguish JS
  completion from browser painting; a fast callback is not proof of a smooth frame.
- Use 60 Hz (16.7 ms total frame budget) as the initial target on recorded hardware
  for the representative workload, with room left for browser painting and input.
  Record the largest workload that meets it. Treat the stress case as a scaling
  limit to characterize, not an unmeasured guarantee.
- Optimize the measured bottleneck: path preparation, labels, source copying,
  output reconciliation, geometry detail, or browser paint. Consider an imperative
  DOM backend only if React output work is material after subtree reuse is working.
- Publish examples, lifecycle/event/ref semantics, identity rules, cache limits,
  benchmarks, and an export path for a selected replay frame.

Exit: reproducible evidence of the improvement, bounded memory in a sustained run,
and documented behavior another interactive application can rely on.

## Verification and completion criteria

Use existing package tests and type checks for affected behavior. Add focused
contract checks only where necessary to establish the new renderer and cache
features. Browser validation is essential for DOM retention, pointer capture,
font readiness, and paint fidelity; markup snapshots alone cannot establish them.

The minimum correctness set is:

- Keyed insert/delete/reorder, repeated fragment placements, and transform changes
  preserve the intended node ownership and paint order.
- Rectangle and path clips intersect correctly; reused definitions are isolated
  across roots and retired after use. Transparent paint and text grouping preserve
  compositing behavior.
- Exact geometry agrees between DOM and export output. Live text uses matching
  faces, including weight/style and the existing emoji fallback behavior.
- Handler-only updates, selection changes, and camera changes invalidate the work
  their semantics require. Immutable source snapshots remain trustworthy.
- Mount/unmount, pending font loads, internal React hook updates, errors, and
  dataset replacement leave coherent output and release host-owned resources.
- Static geography remains reusable during playback; sustained resize and zoom
  do not accumulate an unbounded history of cached views or layout queries.

Run relevant package commands from the Gum workspace, for example:

```sh
bun run --cwd gum-jsx-react test
bun run --cwd gum-jsx-react typecheck
bun run --cwd gum-jsx-core test
bun run --cwd gum-jsx-maps test
```

Broaden verification when core contracts affect other backends. The roadmap does
not require implementing every future optimization before the viewer is useful.
Complete phases 0–3 as a reusable interactive renderer, then phases 4–6 as its
map/replay performance proving ground. Start broader work on fine-grained resource
dependencies, worker layout, alternate backends, hydration, or generalized animation
only when a concrete consumer or measurement establishes the need.
