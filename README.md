# DealRoom — Live AI Lead Qualification & Mutual Deal-Locking Desk

> Built for the **Nexconn Build Challenge 2026**  
> **Live App:** https://live-deal-room.vercel.app/  
> **Demo Video:** https://youtu.be/eJy24LVLk7w  
> **Nexconn App Key:** `x4vkb1qpx5spk`

**DealRoom** replaces slow agency email threads and static contact forms with a single synchronized closing workspace powered by **`@nexconn/chat`** and **Gemini 2.5 Flash**. Prospective clients are qualified by an AI Scope Strategist into a structured live proposal, while the agency founder can jump in live to create or revise quotes and enforce a two-way mutual deal lock.

---

## Key Features

- **AI Scope Strategist (`Gemini 2.5 Flash`):** Answers service capability questions and parses natural-language project scope, budget, and timeline into a structured proposal card with tailored deliverables.
- **Real-Time Multi-Party Sync (`@nexconn/chat`):** Synchronizes chat messages, AI concierge handoff summaries, live quote revisions, and deal-lock states between `client_lead` and `agency_founder`.
- **Founder Quote Builder & Live Revision Desk:** Allows the agency founder to author a quote from scratch or adjust title, price, timeline, and deliverables live in real time.
- **Two-Way Mutual Deal Lock & Deal Ticket (`#DR-104`):** Requires client approval (`CLIENT_APPROVED`) followed by founder countersignature (`LOCKED`), triggering a **Deal Successful** confirmation modal on both sides and a reviewable, copyable **Deal Ticket**.
- **Editorial Design System:** Warm Cream (`#F7F4EC`) with a soft grid canvas, Deep Ink (`#14181F`), Navy (`#1B365D`) accents, `Plus Jakarta Sans`, and `JetBrains Mono`.

---

## Nexconn SDK (`@nexconn/chat`) Features Used

- **Engine Initialization & Regional Routing (`NCEngine.initialize` & `AreaCode.SG`):** Boots the Nexconn client engine with the project App Key and Singapore region routing (`lib/nexconn.ts`).
- **Token-Based User Authentication (`NCEngine.connect`):** Authenticates `client_lead` and `agency_founder` roles via server-issued tokens from `/api/token`.
- **Connection & Offline Sync Lifecycle Listeners (`addConnectionStatusListener`):** Tracks live connection status in the Deal Room header and safely handles offline message sync callbacks.
- **1:1 Direct Messaging Channels (`DirectChannel` & `DirectChannelIdentifier`):** Establishes direct peer-to-peer messaging between the client and founder.
- **Outbound Text & Structured State Payloads (`SendTextMessageParams` & `channel.sendMessage`):** Sends live negotiation messages and serialized quote state updates (`__QUOTE_SYNC__:`) across the channel.
- **Real-Time Inbound Handlers (`NCEngine.addMessageHandler` / `onMessageReceived`):** Streams incoming messages and remote quote updates to keep both desks synchronized.

---

## Project Architecture

```text
app/
├── page.tsx                  # Role-selection landing gateway (Client Lead vs. Agency Founder)
├── deal-room/
│   └── page.tsx              # Split-pane live thread, proposal sheet, founder builder & Deal Ticket modals
├── api/
│   ├── token/route.ts        # Server-side Nexconn App Key & role token broker
│   └── ai-qualify/route.ts   # Gemini 2.5 Flash qualification & structured proposal endpoint
├── layout.tsx                # Root layout & Google Fonts (Plus Jakarta Sans, JetBrains Mono)
└── globals.css               # Editorial cream-grid theme & Tailwind setup
lib/
└── nexconn.ts                # @nexconn/chat SDK wrapper & real-time event sync
```

---

## How to Try the Live Demo

1. Open [https://live-deal-room.vercel.app/](https://live-deal-room.vercel.app/) in **two side-by-side windows**.
2. Enter as **Client Lead** in the left window and **Agency Founder** in the right window.
3. In the **Client Lead** window, ask what services are offered or send a brief such as:  
   `I need a custom SaaS platform, budget is $3,500, timeline is 2 weeks`
4. Watch the structured proposal auto-generate and sync live to both windows.
5. In the **Agency Founder** window, revise the price or deliverables and click **Push Updated Quote**.
6. Click **Approve Quote** on the client side, then click **Confirm & Lock Deal** on the founder side to trigger the **Deal Successful** popup and inspect **Deal Ticket `#DR-104`**.

---

## Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/joshuaabraham640-lgtm/live-deal-room.git
   cd live-deal-room
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**  
   Create a `.env.local` file in the project root:
   ```env
   NEXT_PUBLIC_NEXCONN_APP_KEY=your_nexconn_app_key
   NEXCONN_TEST_TOKENS={"client_lead":"your_client_token","agency_founder":"your_founder_token"}
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app locally.

---

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **Real-Time Messaging:** `@nexconn/chat` SDK
- **AI Qualification:** Google Gemini API (`gemini-2.5-flash`)
- **Deployment:** Vercel