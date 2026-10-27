---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Chat app shell (all of src/)

Scope: the whole chat surface (sidebar, top bar, conversation, composer, connection banner, settings sheet; persona space restyled through tokens). Mode: Operate. Build path: code-led (Operate surface; no comps).

Audience/job: owner chatting with self-hosted small models daily on phone and desktop; recover fast when the tunnel drops.

Constraints: user-pinned world = awesome-design-md warm cream (DESIGN.md). User asked for a mascot and "no textual UI": controls are icons with aria-label + tooltip; text is reserved for content (messages, chat titles, model names, error detail). Keep all existing behaviour.

## Direction contract

THESIS: A warm reading room run by a small coral companion. Refuses the grey-slab chat template with a text-labelled chrome; chrome becomes icons and one character.

OWN-WORLD: Cream canvas #faf9f5 / warm near-black #1f1e1b in dark; ink #141413; coral #cc785c as the only voltage (send, active, mascot); surface-card #efe9de for user bubbles and popovers; hairline #e6dfd8. Inter UI, Source Serif 4 for assistant prose, JetBrains Mono for code. 8px controls, 12px cards, pill composer corners at 20px.

STORY: Open app, the mascot tells you the server state at a glance (awake, thinking, asleep); you type; replies read like a page, not a log.

FIRST VIEWPORT: Desktop: 260px cream sidebar (mascot mark + new-chat icon top, persona row, chat list, icon footer). Main: centred 720px column under a top fade (desktop has no top bar: connection status lives in the sidebar mascot mark, per PRODUCT.md Principle 2 'chrome recedes'; mobile keeps a slim bar with menu, mascot status and new chat); empty chat shows the mascot large at optical centre with no words; composer docked bottom as one rounded field with attach icon, model chip carrying the thinking-level glyph (one control instead of two, Principle 2), coral send.

FORM: Pinned world (warm cream), Operate shell standard; signature move = the mascot as the live state indicator everywhere state exists (sidebar mark, mobile top bar, empty state, waiting-for-first-token, disconnected banner). seed:446653150b402251 (pinned world beats the roll; reference recorded)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
