# Product

<!-- impeccable:product-schema 1 -->

> The user skipped the interview ("just start, skip the questions"). Facts marked *(inferred)* come from the repository and conversation, not from a confirmed answer.

## Platform

web

## Users

The owner (Himanshu) as a daily driver replacement for hosted chat apps, on desktop and phone (installed as a PWA). *(inferred from README)* A secondary audience is people chatting with "Ananya", the Hinglish yoga/wellness persona. *(inferred from config/persona.json)*

## Product Purpose

A fast, lightweight chat interface for self-hosted open models served by Ollama, reached through a Cloudflare quick tunnel whose URL is published to `config/model-url.txt` and synced automatically. Success: it feels as good as a commercial chat app while running on the owner's own hardware at zero cost. *(inferred)*

## Positioning

Your own models, your own GPU, no account, no subscription. The app auto-discovers the current tunnel URL, so a restarted tunnel heals itself. *(inferred)*

## Operating Context

- The backend is a 4 GB GTX 1650 Ti laptop running Ollama with small models (currently `gemma4:e2b`), so replies are fast but the models are small. Previously it ran on Colab T4.
- Connections drop when the tunnel restarts, so connection state and recovery are first-class.
- Used on mobile and desktop; PWA install. Deployed on Vercel.

## Capabilities and Constraints

Streaming chat with Markdown/code/math, multiple conversations (localStorage), regenerate/edit-resend, image upload for vision models, document attach with local RAG (IndexedDB, pdf.js), web search tool (Tavily, optional), connection banner with retry/sync/manual URL, settings panel (URL, model, documents), dark/light theme, persona mode (Ananya) with chat and voice call (Web Speech, Hinglish transliteration), persona memory.

Stack: React 19, TypeScript, Vite, Zustand, CSS Modules with tokens in `src/tokens.css`. No UI component library.

## Brand Commitments

- Persona "Ananya" with her own avatar photo, name, voice and Hinglish copy — preserve.
- User direction (2026-10-28): follow the **warm cream** style from awesome-design-md (see DESIGN.md); add a **mascot** character; **icon-driven UI, minimal text labels**.

## Evidence on Hand

No testimonials, metrics or press. Do not invent any.

## Product Principles

1. Speed first: nothing in the chrome should slow down sending or reading a reply.
2. The conversation is the product; chrome recedes.
3. Connection problems are explained and recoverable in one tap.
4. Works equally well one-handed on a phone.

## Accessibility & Inclusion

Icon-only controls must keep accessible names (aria-label) and tooltips. *(inferred requirement from the icon-only direction)*
