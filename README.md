# Ollama Chat

A fast, lightweight chat interface for self-hosted LLMs via [Ollama](https://ollama.com). Built as a daily-driver replacement for ChatGPT and Claude when running local or cloud-hosted open-source models. Pair it with Ollama on a free Google Colab T4 GPU and a Cloudflare tunnel for a zero-cost, private AI chat experience.

## Features

**Streaming Responses** -- Real-time token-by-token display as the model generates, with a blinking cursor indicator during output.

**Rich Markdown Rendering** -- Full support for headings, bold, italic, lists, tables, blockquotes, inline code, and GFM extensions via `react-markdown` and `remark-gfm`.

**Syntax-Highlighted Code Blocks** -- Fenced code blocks with automatic language detection, a language label, always-dark styling for readability, and a one-click copy button.

**Multi-Conversation Sidebar** -- Create, switch between, rename, and delete conversations. Chat history persists across sessions via `localStorage`.

**Dark / Light Theme** -- Toggle between dark and light modes from the sidebar. Dark is the default. Preference is persisted automatically.

**Settings Panel** -- Configure the Ollama server URL and select from available models in a slide-out panel. Connection status is shown with a live indicator.

**Smart Auto-Scroll** -- Automatically follows streaming output. Disengages when the user scrolls up, and shows a jump-to-bottom button to re-engage.

**Copy Message** -- Copy any assistant response to the clipboard with a single click, similar to the copy button in Claude.ai.

**Thinking Indicator** -- Displays an animated indicator with an elapsed-time counter while waiting for the model to begin generating.

**Image Upload** -- Attach images for multimodal vision models (e.g., Gemma 3). Images are base64-encoded and sent inline with the chat payload.

**Responsive Layout** -- Fully usable on mobile devices. The sidebar collapses behind a hamburger menu with an overlay backdrop on small screens.

**PWA Support** -- Installable as a Progressive Web App on both mobile and desktop. Includes a web manifest, app icons, and standalone display mode.

**Persistent State** -- Conversations, connection settings, selected model, and theme preference are all saved to `localStorage` via Zustand's persist middleware.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| State Management | Zustand (with persist middleware) |
| Markdown | react-markdown + remark-gfm |
| Syntax Highlighting | highlight.js |
| Styling | CSS Modules + CSS custom properties (design tokens) |
| Linting | ESLint + typescript-eslint |

No heavy UI component libraries. The entire UI is built with lightweight, custom components and CSS Modules for minimal bundle size and full design control.

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Ollama** running locally or on a remote server (see [Configuration](#configuration))

### Install

```bash
git clone https://github.com/your-username/ollama-chat.git
cd ollama-chat
npm install
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173` by default.

### Production Build

```bash
npm run build
```

Output is written to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Configuration

### Connecting to Ollama

1. Open the app and click the **Settings** icon (gear) in the top bar or sidebar footer.
2. Enter your Ollama server URL (e.g., `http://localhost:11434` or a Cloudflare tunnel URL).
3. Click **Connect**. The panel will display the connection status and list available models.
4. Select a model from the dropdown.

The URL and selected model are persisted -- the app will silently attempt to reconnect on reload.

### Running Ollama on Google Colab (Free T4 GPU)

For users without a local GPU, Ollama can run on Google Colab's free T4 tier and be exposed via Cloudflare tunnel:

1. Start a Colab notebook with a T4 GPU runtime.
2. Install and start Ollama, then pull your desired model (e.g., `gemma3:12b`).
3. Use `cloudflared` to create a tunnel exposing Ollama's port:
   ```bash
   cloudflared tunnel --url http://localhost:11434
   ```
4. Copy the generated `*.trycloudflare.com` URL into the app's Settings panel.

Note: The Cloudflare tunnel URL changes each time you restart the Colab session. Update the URL in Settings accordingly.

## Deployment

### Vercel

The project includes a `vercel.json` with SPA rewrites pre-configured. To deploy:

```bash
npm install -g vercel
vercel
```

Or connect the GitHub repository directly in the Vercel dashboard for automatic deployments on push.

## Project Structure

```
ollama-chat/
├── public/                  # Static assets, PWA manifest, app icons
├── src/
│   ├── components/
│   │   ├── ChatArea/        # Message list, chat viewport, empty state
│   │   ├── InputArea/       # Text input, send button
│   │   ├── Markdown/        # Markdown renderer, code block component
│   │   ├── Settings/        # Settings panel and overlay
│   │   ├── Sidebar/         # Sidebar, chat items, header, footer
│   │   ├── TopBar/          # Top navigation bar, model badge
│   │   └── ui/              # Shared UI primitives (IconButton, StatusDot)
│   ├── hooks/               # Custom hooks (streaming, auto-resize, click outside)
│   ├── services/            # Ollama API client (fetch models, stream chat)
│   ├── store/               # Zustand stores (chat, connection, UI state)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Root application component
│   ├── tokens.css           # CSS custom properties (design tokens)
│   ├── reset.css            # CSS reset
│   └── markdown.css         # Markdown-specific styles
├── index.html               # Entry HTML with meta tags and Open Graph
├── vite.config.ts           # Vite configuration
├── vercel.json              # Vercel SPA rewrite rules
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## License

MIT
