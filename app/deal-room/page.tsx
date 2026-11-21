'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  Check,
  ArrowLeft,
  Wifi,
  WifiOff,
  Lock,
  Plus,
} from 'lucide-react';
import {
  connectNexconn,
  subscribeDealRoomEvents,
  sendNexconnMessage,
} from '@/lib/nexconn';

type Role = 'client_lead' | 'agency_founder';
type Sender = Role | 'ai_concierge';

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  timestamp: string;
}

type QuoteStatus =
  | 'PENDING_APPROVAL'
  | 'FOUNDER_UPDATED'
  | 'CLIENT_APPROVED'
  | 'LOCKED';

interface QuoteData {
  projectTitle: string;
  summary: string;
  deliverables: string[];
  price: string;
  timeline: string;
  status: QuoteStatus;
}

const QUOTE_PREFIX = '__QUOTE_SYNC__:';

function formatNow(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'LOCKED':
      return 'MUTUALLY LOCKED';
    case 'CLIENT_APPROVED':
      return 'CLIENT APPROVED · FOUNDER CONFIRM';
    case 'FOUNDER_UPDATED':
      return 'REVISED BY FOUNDER';
    default:
      return 'AWAITING CLIENT APPROVAL';
  }
}

function DealRoomContent() {
  const searchParams = useSearchParams();
  const role: Role =
    searchParams.get('role') === 'agency_founder'
      ? 'agency_founder'
      : 'client_lead';
  const peerId: Role = role === 'client_lead' ? 'agency_founder' : 'client_lead';

  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiHandedOff, setAiHandedOff] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai_concierge',
      text: 'Ask what services we offer or share what you want to build, your target budget, and your timeline to generate a live deal quote.',
      timestamp: 'Just now',
    },
  ]);

  const [quote, setQuote] = useState<QuoteData | null>(null);

  // Founder builder / editor state
  const [draftTitle, setDraftTitle] = useState('Custom SaaS & Web Build');
  const [draftPrice, setDraftPrice] = useState('$2,000');
  const [draftTimeline, setDraftTimeline] = useState('2 weeks');
  const [draftSummary, setDraftSummary] = useState(
    'Scoped deliverables tailored to client requirements.'
  );
  const [draftDeliverablesText, setDraftDeliverablesText] = useState(
    'Core application & UI implementation\nAPI & real-time state integration\nTesting, polish & deployment'
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  function hydrateFounderDraft(nextQuote: QuoteData) {
    setDraftTitle(nextQuote.projectTitle);
    setDraftPrice(nextQuote.price);
    setDraftTimeline(nextQuote.timeline);
    setDraftSummary(nextQuote.summary);
    setDraftDeliverablesText(nextQuote.deliverables.join('\n'));
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeDealRoomEvents(role, (incoming) => {
      if (!active) return;

      if (incoming.quote) {
        const syncedQuote = incoming.quote as QuoteData;
        setQuote(syncedQuote);
        hydrateFounderDraft(syncedQuote);
        setAiHandedOff(true);
        return;
      }

      if (typeof incoming.text === 'string' && incoming.text.length > 0) {
        const text = incoming.text;

        if (text.startsWith(QUOTE_PREFIX)) {
          try {
            const parsedQuote = JSON.parse(
              text.slice(QUOTE_PREFIX.length)
            ) as QuoteData;
            setQuote(parsedQuote);
            hydrateFounderDraft(parsedQuote);
            setAiHandedOff(true);
          } catch (err) {
            console.error('Failed to parse synced quote:', err);
          }
          return;
        }

        const isAiNote = text.startsWith('[AI Concierge]: ');
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            sender: isAiNote ? 'ai_concierge' : peerId,
            text: isAiNote ? text.replace('[AI Concierge]: ', '') : text,
            timestamp: formatNow(),
          },
        ]);
        setAiHandedOff(true);
      }
    });

    async function init() {
      try {
        const res = await fetch(`/api/token?userId=${role}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load token');

        await connectNexconn(data.appKey, data.token);
        if (!active) return;
        setConnected(true);
      } catch (err: unknown) {
        if (active) {
          setConnError(
            err instanceof Error ? err.message : 'Nexconn connection error'
          );
        }
      }
    }

    init();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [role, peerId]);

  async function pushQuoteUpdate(updatedQuote: QuoteData) {
    setQuote(updatedQuote);
    hydrateFounderDraft(updatedQuote);
    await sendNexconnMessage(peerId, role, {
      quote: updatedQuote,
      text: `${QUOTE_PREFIX}${JSON.stringify(updatedQuote)}`,
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const outgoingMsg: ChatMessage = {
      id: `${Date.now()}`,
      sender: role,
      text: trimmed,
      timestamp: formatNow(),
    };

    const nextHistory = [...messages, outgoingMsg];
    setMessages(nextHistory);
    setInput('');

    await sendNexconnMessage(peerId, role, { text: trimmed });

    if (role === 'client_lead' && !aiHandedOff) {
      setIsAiThinking(true);
      try {
        const res = await fetch('/api/ai-qualify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({
              role: m.sender === 'client_lead' ? 'Client' : 'Concierge',
              text: m.text,
            })),
          }),
        });

        const aiData = await res.json();
        const replyText: string =
          aiData.reply ||
          'Share what you want to build, your target budget, and your timeline.';

        const aiMessage: ChatMessage = {
          id: `${Date.now()}-ai`,
          sender: 'ai_concierge',
          text: replyText,
          timestamp: formatNow(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        await sendNexconnMessage(peerId, role, {
          text: `[AI Concierge]: ${replyText}`,
        });

        if (aiData.readyForQuote && aiData.quote) {
          setAiHandedOff(true);
          await pushQuoteUpdate(aiData.quote as QuoteData);
        }
      } catch (err) {
        console.error('AI qualification failed:', err);
      } finally {
        setIsAiThinking(false);
      }
    }
  }

  async function handleFounderCreateOrPushQuote(e: React.FormEvent) {
    e.preventDefault();
    const deliverables = draftDeliverablesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const isNewCreation = !quote;
    const nextQuote: QuoteData = {
      projectTitle: draftTitle.trim() || 'Custom Project Proposal',
      summary:
        draftSummary.trim() || 'Custom scope prepared by the agency founder.',
      deliverables:
        deliverables.length > 0
          ? deliverables
          : ['Custom build & delivery per agreed scope'],
      price: draftPrice.trim() || '$2,000',
      timeline: draftTimeline.trim() || '2 weeks',
      status: isNewCreation ? 'PENDING_APPROVAL' : 'FOUNDER_UPDATED',
    };

    setAiHandedOff(true);
    await pushQuoteUpdate(nextQuote);

    const note = isNewCreation
      ? `Created a new quote: "${nextQuote.projectTitle}" at ${nextQuote.price} (${nextQuote.timeline}).`
      : `Updated quote to ${nextQuote.price} (${nextQuote.timeline}). Ready for your review.`;

    await sendNexconnMessage(peerId, role, { text: note });
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-founder-quote`,
        sender: 'agency_founder',
        text: note,
        timestamp: formatNow(),
      },
    ]);
  }

  async function handleClientApprove() {
    if (!quote) return;

    const updated: QuoteData = {
      ...quote,
      status: 'CLIENT_APPROVED',
    };

    await pushQuoteUpdate(updated);
    const note = `Client approved ${updated.price}. Awaiting founder final lock.`;
    await sendNexconnMessage(peerId, role, { text: note });

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-client-approve`,
        sender: 'client_lead',
        text: note,
        timestamp: formatNow(),
      },
    ]);
  }

  async function handleFounderFinalApprove() {
    if (!quote) return;

    const locked: QuoteData = {
      ...quote,
      status: 'LOCKED',
    };

    await pushQuoteUpdate(locked);
    const note = `Founder confirmed ${locked.price}. Deal is now mutually locked.`;
    await sendNexconnMessage(peerId, role, { text: note });

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-founder-lock`,
        sender: 'agency_founder',
        text: note,
        timestamp: formatNow(),
      },
    ]);
  }

  return (
    <div className="min-h-screen bg-cream-grid text-[#14181F] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#14181F]/15 bg-[#FCFBF7]/90 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-[#14181F]/70 hover:text-[#1B365D] flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Roles</span>
          </Link>
          <span className="text-[#14181F]/25">/</span>
          <span className="font-mono text-sm font-medium text-[#14181F]">
            Room #104
          </span>
          <span className="font-mono text-xs px-3 py-1 rounded-xl bg-[#1B365D] text-[#F7F4EC]">
            {role === 'client_lead' ? 'Client' : 'Founder'}
          </span>
        </div>

        <div className="font-mono text-xs">
          {connected ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1B365D]/10 text-[#1B365D] border border-[#1B365D]/25">
              <Wifi className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14181F]/10 text-[#14181F]/75 border border-[#14181F]/20">
              <WifiOff className="w-3.5 h-3.5" />
              {connError ? connError : 'Connecting'}
            </span>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 py-8">
        {/* Left: Thread */}
        <section className="lg:col-span-7 flex flex-col bg-[#FCFBF7] border border-[#14181F]/20 rounded-xl overflow-hidden h-[78vh]">
          <div className="px-6 py-4 border-b border-[#14181F]/15 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#14181F]">
              {aiHandedOff ? 'Client & Founder Thread' : 'AI Scope Strategist'}
            </h2>
            <span className="font-mono text-xs text-[#1B365D]">
              {aiHandedOff ? 'Founder active' : 'Qualifying'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.map((msg) => {
              const isSelf = msg.sender === role;
              const isAi = msg.sender === 'ai_concierge';
              const label = isAi
                ? 'AI Strategist'
                : msg.sender === 'agency_founder'
                ? 'Founder'
                : 'Client';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${
                    isSelf ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="font-mono text-[11px] text-[#14181F]/55 px-1">
                    {label} · {msg.timestamp}
                  </span>
                  <div
                    className={`max-w-[82%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                      isSelf
                        ? 'bg-[#1B365D] text-[#F7F4EC]'
                        : isAi
                        ? 'bg-[#F7F4EC] border border-[#1B365D]/25 text-[#14181F]'
                        : 'bg-[#F7F4EC] border border-[#14181F]/20 text-[#14181F]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isAiThinking && (
              <div className="font-mono text-xs text-[#1B365D]">
                Drafting proposal...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="p-4 border-t border-[#14181F]/15 flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                role === 'client_lead'
                  ? 'Ask about services or share project, budget & timeline...'
                  : 'Send a live message to the client...'
              }
              className="flex-1 bg-[#F7F4EC] border border-[#14181F]/20 focus:border-[#1B365D] rounded-xl px-4 py-2.5 text-sm text-[#14181F] placeholder:text-[#14181F]/45 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#1B365D] hover:bg-[#142847] text-[#F7F4EC] font-medium text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </section>

        {/* Right: Proposal Sheet + Founder Quote Builder */}
        <aside className="lg:col-span-5">
          <div className="h-[78vh] bg-[#FCFBF7] border border-[#14181F]/20 rounded-xl p-6 flex flex-col justify-between overflow-y-auto gap-6">
            {quote ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#14181F]/15">
                  <span className="font-mono text-xs text-[#14181F]/60">
                    PROPOSAL
                  </span>
                  <span className="font-mono text-[11px] px-3 py-1 rounded-xl bg-[#1B365D]/10 text-[#1B365D] border border-[#1B365D]/25">
                    {getStatusLabel(quote.status)}
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-[#14181F]">
                    {quote.projectTitle}
                  </h2>
                  <p className="text-sm text-[#14181F]/75 leading-relaxed">
                    {quote.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#14181F]/15">
                  <div>
                    <span className="font-mono text-xs text-[#14181F]/60 block mb-1">
                      BUDGET
                    </span>
                    <span className="font-mono text-2xl font-semibold text-[#1B365D]">
                      {quote.price}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-xs text-[#14181F]/60 block mb-1">
                      TIMELINE
                    </span>
                    <span className="font-mono text-2xl font-semibold text-[#14181F]">
                      {quote.timeline}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-mono text-xs text-[#14181F]/60">
                    DELIVERABLES
                  </h3>
                  <ul className="space-y-2.5">
                    {quote.deliverables.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[#14181F]"
                      >
                        <Check className="w-4 h-4 text-[#1B365D] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : role === 'client_lead' ? (
              <div className="my-auto py-12 px-4 text-center space-y-3">
                <p className="font-mono text-xs uppercase tracking-wider text-[#1B365D]">
                  Proposal
                </p>
                <h3 className="text-lg font-semibold text-[#14181F]">
                  No active quote yet
                </h3>
                <p className="text-sm text-[#14181F]/70 max-w-xs mx-auto leading-relaxed">
                  Share what you want to build, your budget, and your timeline in chat to generate a deal proposal.
                </p>
              </div>
            ) : null}

            {/* Founder Quote Builder / Editor */}
            {role === 'agency_founder' && (
              <form
                onSubmit={handleFounderCreateOrPushQuote}
                className="pt-5 border-t border-[#14181F]/15 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#1B365D]">
                    {quote ? 'REVISE QUOTE' : 'CREATE QUOTE'}
                  </span>
                </div>

                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Project title"
                  className="w-full bg-[#F7F4EC] border border-[#14181F]/20 focus:border-[#1B365D] rounded-xl px-3.5 py-2 text-sm text-[#14181F] focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    placeholder="Price (e.g. $2,500)"
                    className="bg-[#F7F4EC] border border-[#14181F]/20 focus:border-[#1B365D] rounded-xl px-3.5 py-2 font-mono text-sm text-[#14181F] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={draftTimeline}
                    onChange={(e) => setDraftTimeline(e.target.value)}
                    placeholder="Timeline (e.g. 2 weeks)"
                    className="bg-[#F7F4EC] border border-[#14181F]/20 focus:border-[#1B365D] rounded-xl px-3.5 py-2 font-mono text-sm text-[#14181F] focus:outline-none"
                  />
                </div>

                <textarea
                  rows={2}
                  value={draftDeliverablesText}
                  onChange={(e) => setDraftDeliverablesText(e.target.value)}
                  placeholder="One deliverable per line"
                  className="w-full bg-[#F7F4EC] border border-[#14181F]/20 focus:border-[#1B365D] rounded-xl px-3.5 py-2 text-xs text-[#14181F] focus:outline-none"
                />

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142847] text-[#F7F4EC] font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {quote ? 'Push Updated Quote' : 'Create & Send Quote'}
                  </span>
                </button>
              </form>
            )}

            {/* Approval / Lock Controls */}
            {quote && (
              <div className="pt-4 border-t border-[#14181F]/15">
                {quote.status === 'LOCKED' ? (
                  <div className="w-full py-3 px-4 rounded-xl bg-[#1B365D] text-[#F7F4EC] text-sm font-medium flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Deal Locked at {quote.price}</span>
                  </div>
                ) : role === 'client_lead' ? (
                  quote.status === 'CLIENT_APPROVED' ? (
                    <div className="w-full py-3 px-4 rounded-xl bg-[#F7F4EC] border border-[#14181F]/20 text-[#14181F]/75 text-sm text-center">
                      Approved ({quote.price}) · Waiting for founder lock
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClientApprove}
                      className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142847] text-[#F7F4EC] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Quote ({quote.price})</span>
                    </button>
                  )
                ) : quote.status === 'CLIENT_APPROVED' ? (
                  <button
                    type="button"
                    onClick={handleFounderFinalApprove}
                    className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142847] text-[#F7F4EC] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Confirm &amp; Lock Deal ({quote.price})</span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 px-4 rounded-xl bg-[#F7F4EC] border border-[#14181F]/15 text-[#14181F]/65 text-xs font-mono text-center">
                    Awaiting client approval to lock
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function DealRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream-grid text-[#14181F] p-8 font-mono text-sm">
          Loading room...
        </div>
      }
    >
      <DealRoomContent />
    </Suspense>
  );
}