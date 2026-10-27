---
name: Ollama Chat
description: A warm-cream reading room for chatting with self-hosted models, kept by a small coral companion.
colors:
  cream-canvas: "#faf9f5"
  parchment-sidebar: "#f5f0e8"
  paper-input: "#fffdf9"
  oat-card: "#efe9de"
  hairline: "#e6dfd8"
  ink: "#141413"
  ink-muted: "#57554f"
  ink-faint: "#75726b"
  coral: "#cc785c"
  coral-deep: "#a9583e"
  coral-ink: "#9a4f36"
  coral-halo: "rgba(204, 120, 92, 0.16)"
  hover-wash: "rgba(20, 20, 19, 0.045)"
  active-wash: "rgba(20, 20, 19, 0.075)"
  scrim: "rgba(20, 20, 19, 0.32)"
  code-night: "#181715"
  code-bar: "#252320"
  code-text: "#e8e4dc"
  code-muted: "#a09d96"
  success: "#3f9a56"
  error: "#c64545"
  warning: "#b8860b"
  mascot-cheek: "#e8a55a"
  night-canvas: "#1f1e1b"
  night-sidebar: "#181715"
  night-input: "#2a2925"
  night-input-focus: "#2d2b27"
  night-card: "#2f2d29"
  night-inline-code: "#33312c"
  night-sheet: "#252320"
  night-hairline: "#36342f"
  night-ink: "#faf9f5"
  night-ink-muted: "#c2beb5"
  night-ink-faint: "#9a968d"
  night-coral: "#d98b70"
  night-coral-light: "#e6a088"
  night-coral-halo: "rgba(217, 139, 112, 0.18)"
  night-hover-wash: "rgba(250, 249, 245, 0.05)"
  night-active-wash: "rgba(250, 249, 245, 0.085)"
  night-scrim: "rgba(0, 0, 0, 0.5)"
  night-code: "#161513"
  night-code-bar: "#2a2824"
  night-success: "#5db872"
  night-error: "#e06c6c"
  night-warning: "#e8a55a"
typography:
  prose:
    fontFamily: "'Source Serif 4 Variable', Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "-0.003em"
  prose-headline:
    fontFamily: "'Source Serif 4 Variable', Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'cv11', 'ss01'"
  input:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
  mono-label:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "20px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    size: "44px"
  icon-button-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.ink}"
  send-button:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.paper-input}"
    rounded: "{rounded.md}"
    size: "36px"
  send-button-hover:
    backgroundColor: "{colors.coral-deep}"
  composer:
    backgroundColor: "{colors.paper-input}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.xl}"
    padding: "12px 8px 8px 8px"
    width: "720px"
  model-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 8px 0 12px"
  user-bubble:
    backgroundColor: "{colors.oat-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  assistant-reply:
    textColor: "{colors.ink}"
    typography: "{typography.prose}"
    width: "720px"
  chat-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  chat-item-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.ink}"
  chat-item-active:
    backgroundColor: "{colors.active-wash}"
    textColor: "{colors.ink}"
  sidebar:
    backgroundColor: "{colors.parchment-sidebar}"
    width: "260px"
  popover:
    backgroundColor: "{colors.cream-canvas}"
    rounded: "{rounded.lg}"
    padding: "8px"
  code-window:
    backgroundColor: "{colors.code-night}"
    textColor: "{colors.code-text}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "16px"
  code-window-bar:
    backgroundColor: "{colors.code-bar}"
    textColor: "{colors.code-muted}"
    typography: "{typography.mono-label}"
    padding: "4px 8px 4px 16px"
  connection-banner:
    backgroundColor: "{colors.parchment-sidebar}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "8px 8px 8px 12px"
  settings-sheet:
    backgroundColor: "{colors.parchment-sidebar}"
    width: "384px"
    padding: "8px 20px 24px"
  status-card:
    backgroundColor: "{colors.oat-card}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 12px"
  field:
    backgroundColor: "{colors.paper-input}"
    textColor: "{colors.ink}"
    typography: "{typography.mono-label}"
    rounded: "{rounded.md}"
    height: "44px"
  doc-pill:
    backgroundColor: "{colors.paper-input}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Ollama Chat

## Overview

**Creative North Star: "The Warm Reading Room"**

A quiet, cream-lit room for reading what your own models write. The canvas is warm paper, the ink is a warm near-black, and there is exactly one voltage in the room: a soft coral that marks the send action, the active state, and the small companion who lives in the corner. Assistant replies are set in a text serif a size larger than the interface, so a reply reads like a printed page rather than a log line. Everything else (navigation, controls, status) recedes into icons and tonal washes so the conversation stays the product.

State is never a status word. A small coral pebble with a spark antenna, Pip, is the live state indicator everywhere the app has state: awake when the server answers, thinking while connecting or waiting for the first token, talking while a reply streams, asleep when the tunnel is unreachable. The chrome around Pip is icon-only; text is reserved for content (messages, chat titles, model names, document names) and for error detail that a person needs to act on.

The world exists in two equal themes, warm cream by day and warm night by dark, sharing the same proportions, type, radii, and mascot palette. Density is calm: a 720px reading column, 32px between messages, controls at 36-44px.

**Key Characteristics:**
- Warm cream canvas and warm-night dark theme; no cool greys anywhere.
- One coral accent, used for send, active, focus, and the mascot.
- Three-voice type: Inter for the interface, Source Serif 4 for assistant prose, JetBrains Mono for code, URLs, and model names.
- Icon-only chrome, every control named by aria-label and title.
- A five-mood mascot as the single state indicator.
- Code windows stay dark in both themes.
- Flat surfaces separated by tone and hairlines; shadow only on things that float.

## Colors

A warm, low-chroma paper palette with a single coral voltage; every neutral leans yellow-brown, never blue.

### Primary
- **Coral** (`coral` light, `night-coral` dark): the only accent. The send and connect buttons, the active segment of the thinking-level control, the selected-model check, the attach badge, the toggle's on track, focus outlines, text caret, progress fills, and the mascot body. Hover deepens it in light (`coral-deep`) and lifts it in dark (`night-coral-light`).
- **Coral Ink** (`coral-ink` light, `night-coral-light` dark): coral dark enough to read as text. Links in prose, the new-chat icon on hover, the sync icon, and toggled-on icon buttons.
- **Coral Halo** (`coral-halo`, `night-coral-halo`): the 3px focus halo around fields and the composer, and text selection.

### Neutral
- **Cream Canvas** (`cream-canvas` / `night-canvas`): the app and main column background; also the popover and segment surface in light.
- **Parchment Sidebar** (`parchment-sidebar` / `night-sidebar`): the sidebar, the connection banner, and the settings sheet, one step off the canvas.
- **Paper Input** (`paper-input` / `night-input`): the composer, text fields, the new-chat button, doc pills and chips. The warmest, lightest surface in light mode, so the place you type always reads as paper on paper.
- **Oat Card** (`oat-card` / `night-card`): user message bubbles, inline code, and the settings status card.
- **Hairline** (`hairline` / `night-hairline`): every 1px border and divider, scrollbar thumbs, the code window's outline.
- **Ink, Ink Muted, Ink Faint** (`ink`, `ink-muted`, `ink-faint` and their `night-` pairs): primary text; secondary text and resting icon color; placeholders, list markers, timestamps, and tertiary icons.
- **Hover and Active Washes**: translucent ink (light) or translucent cream (dark) laid over whatever surface sits beneath, so one hover rule works on canvas, sidebar, and popover alike.
- **Scrim**: the overlay behind the mobile sidebar and the settings sheet.

### Code
- **Code Night, Code Bar, Code Text, Code Muted**: the code window palette. Near-identical in both themes (`code-night` / `night-code`), so a code block is the same dark window by day and by night.

### Status
- **Success, Error, Warning** (and `night-` pairs): success marks the synced state in settings; error tints inline message errors (error text on a 9% error wash) and destructive icon hovers; warning is reserved.

### Mascot
The mascot palette is fixed across themes so the character never changes: body is Coral, shade is Coral Deep, eyes and mouth are Ink, cheeks are `mascot-cheek` at 50% opacity, highlights are Paper Input.

### Named Rules
**The One Voltage Rule.** Coral is the only saturated color on screen. If a second accent seems needed, use a wash, a hairline, or Ink Muted instead.

**The Warm Neutral Rule.** Every neutral leans warm (yellow-brown hue). No cool or blue-tinted greys, including thumbs, knobs, and overlays.

**The Same Room Rule.** Light and dark are one world: each light token has a night pair, and nothing changes between themes except value. The mascot and code window do not change at all.

## Typography

**Interface Font:** Inter Variable (with -apple-system, Segoe UI, system-ui), stylistic sets `cv11` and `ss01` on.
**Prose Font:** Source Serif 4 Variable (with Georgia), optical sizing auto.
**Mono Font:** JetBrains Mono Variable (with ui-monospace, SF Mono, Consolas).

**Character:** A crisp, neutral sans carries every control and the user's own words; a warm text serif carries the model's answers, so the eye can tell who is speaking without a label. Mono marks anything machine-literal.

### Hierarchy
- **Prose** (400, 17px, 1.7, -0.003em): assistant replies only, in the 720px column (about 75 characters per line).
- **Prose Headline** (500, 26 / 22 / 19px for h1 / h2 / h3, 1.25, -0.015em): headings inside assistant replies.
- **Body** (400, 15px, 1.5): the interface base and user bubbles (1.6 line height in bubbles).
- **Input** (400, 16px, 1.5): the composer textarea. 16px keeps mobile browsers from zooming on focus.
- **Title** (500, 14px): chat titles in the sidebar, the persona row, the model name in the composer chip, banner messages (regular weight there).
- **Caption** (400, 12px): doc chips and pills, notices, the first-token timer, tool argument summaries.
- **Code** (400, 13px, 1.6): code windows. Inline code sits at 0.85em of the surrounding text on an Oat Card wash.
- **Mono Label** (500, 12px): code window language bar, tool names, model names in the model list, URL fields, document counts.

### Named Rules
**The Two Voices Rule.** Source Serif 4 is the model's voice and appears only inside assistant replies. Interface, user messages, tables inside replies, and reasoning traces stay in Inter.

**The Literal Is Mono Rule.** URLs, model identifiers, tool names, and code are set in JetBrains Mono; nothing else is.

## Layout

The desktop shell is a fixed 260px sidebar beside a flexible main column. The main column has no top bar on desktop: the conversation scrolls in a centred 720px measure (`--measure`) beneath a 16px top fade mask, with 32px between messages and 32px / 24px outer padding. The composer is docked at the bottom, centred on the same 720px measure, with 24px padding around it. User bubbles are right-aligned at up to 78% of the column; assistant replies take the full column width with no bubble.

The empty chat holds only the mascot at 128px, centred slightly above the true middle (58vh minimum height with 6vh bottom padding) for optical centre. No greeting, no suggestion chips.

**Responsive.** At 768px and below, the sidebar becomes an off-canvas drawer that slides in from the left over a scrim, a slim top bar appears (menu, mascot status, settings), conversation padding drops to 16px, composer padding to 12px, and user bubbles widen to 88%. At 480px and below, the connection banner's message drops to 12px and the URL row loses its indent. The settings sheet is `min(384px, 90vw)` and slides in from the right at every size.

**Spacing rhythm.** A 4px-based scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Controls sit 4px apart in toolbars; list rows use 8px / 12px padding; sections in the settings sheet are 32px apart.

## Elevation & Depth

Flat by default. Surfaces are separated by tone (canvas, parchment, paper, oat) and 1px hairlines, never by shadow. Shadow appears only on elements that float above the page or that you type into.

### Shadow Vocabulary
- **Pop** (`0 10px 30px rgba(61, 45, 30, 0.14), 0 2px 6px rgba(61, 45, 30, 0.08)` light; `0 12px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.24)` dark): popovers (model and attach menus) and the jump-to-latest button.
- **Composer rest** (`0 1px 2px rgba(61, 45, 30, 0.05), 0 6px 20px rgba(61, 45, 30, 0.05)`): a barely-there lift under the composer so the typing surface sits on the page.
- **Focus halo** (`0 0 0 3px` Coral Halo): fields, the composer (with its border mixed 55% toward coral), and drag-over.
- **Segment lift** (`0 1px 2px rgba(20, 20, 19, 0.12)`): the active segment of the thinking-level control.

### Named Rules
**The Float-Only Shadow Rule.** If it does not float or take typing, it has no shadow. Cards, banners, bubbles, the sidebar, and the settings sheet are flat.

**The Brown Shadow Rule.** Light-theme shadows are tinted warm brown (rgb 61, 45, 30), never neutral black.

## Shapes

Gently rounded throughout, in a short scale: 6px for small inner pieces (inline code, segments, chat-row icon buttons, code copy button), 8px for every control and list row, 12px for cards and floating containers (code windows, popovers, connection banner, status card), 20px for the composer, and full pills for doc pills, badges, toggles, and round confirm buttons. The user bubble is a 20px pill with one tightened 6px corner at bottom right, pointing back at its sender. Borders are always 1px hairline; the code window uses a 1px hairline ring (box-shadow) so its dark fill reads in light mode. Icons are 24-unit stroked line icons (stroke 1.9-2, round caps and joins) at 17-18px.

The mascot is the one organic form: a soft pebble body on a 64-unit grid with a four-point spark on a curved stem, two oval feet, and a ground shadow.

## Components

### Icon Buttons
Quiet until touched.
- **Shape:** 8px radius; 44px in the sidebar footer and mobile top bar, 40px in the connection banner and new-chat, 36px in the composer toolbar, 32px for reply actions and code copy.
- **Rest:** transparent, Ink Muted icon.
- **Hover / Active:** Hover Wash with Ink icon; Active Wash on press. Toggled-on uses Active Wash with Coral Ink.
- **Focus:** 2px Coral outline at 2px offset (inset -2px on list rows).
- **New chat:** a bordered variant on Paper Input; hover turns the border Coral and the icon Coral Ink; press scales to 0.94.

### Primary Action (Send, Connect)
The only filled buttons. Coral square with an 8px radius (36px send, 40-44px connect), Paper Input icon, hover to Coral Deep (light) or Coral Light (dark), press scales to 0.92-0.94. Disabled drops to 35% opacity. Edit-and-resend uses the same treatment as a round 36px confirm beside a bordered round cancel.

### Composer
One rounded field (20px) on Paper Input with a hairline border and the composer-rest shadow: the textarea on top (grows to 192px), an icon toolbar below with attach at left, the model chip, and send pushed right. Focus-within mixes the border toward coral and adds the halo; drag-over goes dashed coral. Image previews and doc chips stack above it on the same measure.

### Model Chip
Model name (Title weight, Ink, truncated at 144px) plus the thinking-level glyph and a chevron, on a transparent 36px chip. It opens one popover holding the model list (mono names, coral check on the active one) and a segmented thinking-level control of glyphs: segments on an Active Wash track, active segment on the canvas color in coral with the segment lift.

### Popovers
Canvas surface, hairline border, 12px radius, 8px padding, Pop shadow, opening upward from the composer with a 160ms rise from 4px below. Attach menu holds icon-only 56px tiles (photos, document) and a document checklist.

### Messages
- **User:** Oat Card bubble, Body type, 12px / 16px padding, right-aligned. An edit pencil appears in the left gutter on hover (always visible at reduced opacity on mobile).
- **Assistant:** no bubble; Prose type on the canvas. Reasoning and tool calls collapse into quiet Ink Faint summary lines above the reply that expand to a hairline-ruled aside. A row of 32px icon actions sits under each finished reply.
- **Entry:** each message rises 6px and fades in over 300ms.
- **Error:** an inline 8px-radius strip, error text on a 9% error wash, with an icon. This is where words are allowed: the error detail.

### Code Window
A dark window in both themes: Code Night body, Code Bar header with the language in Mono Label and an icon-only copy button, 12px radius, hairline ring, 16px code padding, Code type. Syntax colors come from a dark highlight theme.

### Sidebar
Parchment, 260px, hairline right edge. Header: mascot mark (connection mood, labelled with the connection state) and the bordered new-chat button. Below: the persona row (avatar ringed in coral, name in Title), a hairline, the chat list, and an icon footer (settings, theme). Chat rows are 40px, Ink Muted at rest, Ink on hover/active with Hover/Active Wash; rename and delete icons fade in on hover behind a gradient that matches the row, delete hovers to error.

### Connection Banner
Sits above the conversation on the 720px measure. While connecting: no frame, just the thinking mascot and three pulsing coral dots (with a visually hidden status line). On failure: a Parchment card (12px, hairline) with the sleeping mascot, the error detail in Ink Muted, and icon actions (retry, sync URL, use a different URL). The URL field opens beneath in mono with a coral connect button. Drops in 6px over 350ms.

### Settings Sheet
A right-side Parchment sheet, `min(384px, 90vw)`, over a scrim, sliding in over 300ms. The header is an icon, not a title. The server section is an Oat Card status card with the mascot at 52px in its connection mood, a mono document count pill, and a sync icon (success check once synced); below it a 44px mono URL field with a leading link icon and a coral connect button.

### Toggle
A 40 x 24px pill track on Paper Input with a hairline, turning Coral when on; a 17px near-white knob slides 16px over 240ms.

### Pip, the Mascot
The single state indicator. Drawn on a 64-unit grid and scaled; it carries an accessible name (the connection label) when it reports state and is hidden from assistive tech when it only accompanies a text status.

| Mood | Meaning | Where | Motion |
|---|---|---|---|
| idle | Connected | Sidebar mark (desktop), mobile top bar, settings status card | Slow 3.6s float, blink every 5.2s |
| happy | Connected, fresh chat | Empty state (128px) | Float, closed smiling eyes, open smile |
| thinking | Connecting, or waiting for the first token | Banner while connecting, under a pending reply (34px) with a timer, any status mark while connecting | Body sways ±3.5deg, spark spins, eyes glance up-right |
| talking | Reply streaming | Trailing the streaming reply (26px) | Faster 2.4s float, mouth opens and closes every 320ms |
| sleeping | Unreachable or not configured | Error banner (36px), status marks, empty state | Desaturated to 55%, 4s breathing, closed eyes, three bubbles rising |

The empty state arrives with a 700ms rise-and-scale from 92%.

## Do's and Don'ts

### Do:
- **Do** give every icon-only control both an `aria-label` and a matching `title` tooltip.
- **Do** reserve text for content: messages, chat titles, model names, document names, counts, and error detail someone must act on.
- **Do** let Pip report state wherever state exists, using the five moods as mapped above; label it with the connection state when it is the only indicator.
- **Do** set assistant replies in Source Serif 4 at 17px / 1.7 on the 720px measure.
- **Do** pair every light token with its night value; test both themes.
- **Do** use the shared ease `cubic-bezier(0.16, 1, 0.3, 1)` for every transition: 120-150ms for hover color, 200ms for focus and chevrons, 300ms for drawers, sheets, and message entry.
- **Do** honour reduced motion: all animation and transition durations collapse to near zero, mascot included.
- **Do** use the 2px coral focus outline on every interactive element.

### Don't:
- **Don't** add text labels, captions, or headings to chrome (sidebar, toolbars, banner actions, settings header); use an icon with a name.
- **Don't** introduce a second accent color or a cool grey.
- **Don't** put shadows on flat surfaces (bubbles, banner, sidebar, cards).
- **Don't** set interface text or user messages in the serif.
- **Don't** theme the code window light; it stays dark in both themes.
- **Don't** recolor the mascot per theme or add new moods without mapping them to an app state.
- **Don't** add a greeting, suggestion chips, or copy to the empty state; the mascot alone is the empty state.
