import { NextRequest, NextResponse } from 'next/server';

export interface QuotePayload {
  projectTitle: string;
  summary: string;
  deliverables: string[];
  price: string;
  timeline: string;
  status:
    | 'PENDING_APPROVAL'
    | 'FOUNDER_UPDATED'
    | 'CLIENT_APPROVED'
    | 'LOCKED';
}

interface IncomingMessage {
  role: string;
  text: string;
}

const OFFERED_SERVICES = [
  'Custom web applications & SaaS platforms (Next.js / TypeScript)',
  'High-conversion product & marketing websites with custom motion',
  'Interactive client portals, booking/quoting desks, and admin workflows',
  'AI workflow & LLM integrations with structured outputs',
  'UI/UX architecture, design systems, and performance optimization',
];

function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON object found in model output');
  }
  return JSON.parse(match[0]);
}

function parseBudgetFromText(text: string): string | null {
  const kMatch = text.match(/([₹$€£]?\s*\d[\d,]*(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const rawNum = parseFloat(kMatch[1].replace(/[^\d.]/g, ''));
    if (!Number.isNaN(rawNum)) {
      const currency = /^[₹$€£]/.test(kMatch[1].trim())
        ? kMatch[1].trim()[0]
        : '$';
      return `${currency}${Math.round(rawNum * 1000).toLocaleString('en-US')}`;
    }
  }

  const currencyMatch = text.match(/[₹$€£]\s*\d[\d,]*(?:\.\d+)?/);
  if (currencyMatch) {
    return currencyMatch[0].replace(/\s+/g, '').replace(/[,.;]+$/, '');
  }

  const budgetPhraseMatch = text.match(
    /(?:budget(?:\s+(?:is|of|around|at))?|price|pay|spend)\s*(?:is|of|around|at|:)?\s*([₹$€£]?\s*\d[\d,]*(?:\.\d+)?)/i
  );
  if (budgetPhraseMatch) {
    const cleanedNum = budgetPhraseMatch[1].replace(/[,.;]+$/, '').trim();
    return /^[₹$€£]/.test(cleanedNum)
      ? cleanedNum.replace(/\s+/g, '')
      : `$${cleanedNum}`;
  }

  return null;
}

function parseTimelineFromText(text: string): string | null {
  const match = text.match(
    /\b(\d+\s*(?:-\s*\d+\s*)?(?:days?|weeks?|months?))\b/i
  );
  return match ? match[1].trim() : null;
}

function hasScopeSignal(text: string): boolean {
  return /\b(saas|platform|app|website|site|landing|portal|dashboard|tool|system|mvp|build|create|develop|redesign|automation|ai|bot|store|ecommerce|e-commerce)\b/i.test(
    text
  );
}

function buildDeliverables(clientText: string, budgetStr: string): string[] {
  const lower = clientText.toLowerCase();
  const numericBudget = parseInt(budgetStr.replace(/[^\d]/g, ''), 10) || 0;
  const isHeavyScope =
    numericBudget >= 5000 ||
    /\b(platform|dashboard|portal|saas|marketplace|full[- ]?stack|ai|automation|multi[- ]?page|auth|billing)\b/.test(
      lower
    );

  if (isHeavyScope) {
    return [
      'Core application architecture, auth & data models',
      'Responsive UI views, interactive workflows & API routes',
      'Billing/integrations setup & QA verification',
      'Production deployment & handover documentation',
    ];
  }

  return [
    'Tailored layout, page sections & conversion flow',
    'Production Next.js + TypeScript implementation',
    'Lead capture / inquiry flow & launch setup',
  ];
}

function buildTitle(clientText: string): string {
  const lower = clientText.toLowerCase();
  if (lower.includes('saas')) return 'SaaS Platform & Web App Build';
  if (lower.includes('portal')) return 'Client Portal & Workflow System';
  if (lower.includes('dashboard')) return 'Analytics & Operations Dashboard';
  if (lower.includes('landing') || lower.includes('website'))
    return 'Custom Web & Conversion Build';
  return 'Custom Software & Product Build';
}

export async function POST(req: NextRequest) {
  let messages: IncomingMessage[] = [];

  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];

    const clientMessages = messages
      .filter((m) => m.role === 'Client')
      .map((m) => m.text)
      .join('\n');

    const detectedBudget = parseBudgetFromText(clientMessages);
    const detectedTimeline = parseTimelineFromText(clientMessages);
    const scopeReady = hasScopeSignal(clientMessages);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const systemPrompt = `
You are a clear, practical deal strategist inside a Live Deal Room.
Offered services:
${OFFERED_SERVICES.map((s, i) => `${i + 1}.${s}`).join('\n')}

Rules:
- If the client asks what services are offered (and hasn't given a full project brief yet), list the relevant offered services concisely and ask what they want to build, their budget, and their timeline.
- Never force or cap a budget to $1,500. Honor whatever budget the client states (for example $2,000, $8,500, ₹2,50,000).
- Whenever the client has provided project scope, budget, and timeline, set "readyForQuote": true and return a structured quote object.
- Keep "reply" concise (1-3 sentences), direct, and natural.

Return ONLY valid JSON:
{
  "readyForQuote": boolean,
  "reply": string,
  "quote": {
    "projectTitle": string,
    "summary": string,
    "deliverables": string[],
    "price": string,
    "timeline": string,
    "status": "PENDING_APPROVAL"
  }
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\nConversation:\n${JSON.stringify(messages)}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error(data?.error?.message || 'Empty Gemini response');
    }

    const parsed = extractJson(rawText) as {
      readyForQuote?: boolean;
      reply?: string;
      quote?: Partial<QuotePayload>;
    };

    const shouldCreateDeal =
      Boolean(parsed.readyForQuote) ||
      (scopeReady && Boolean(detectedBudget) && Boolean(detectedTimeline));

    if (shouldCreateDeal) {
      const finalPrice =
        detectedBudget ||
        (typeof parsed.quote?.price === 'string' && parsed.quote.price.trim()
          ? parsed.quote.price.trim()
          : '$2,000');
      const finalTimeline =
        detectedTimeline ||
        (typeof parsed.quote?.timeline === 'string' &&
        parsed.quote.timeline.trim()
          ? parsed.quote.timeline.trim()
          : '2 weeks');

      const quote: QuotePayload = {
        projectTitle:
          parsed.quote?.projectTitle?.trim() || buildTitle(clientMessages),
        summary:
          parsed.quote?.summary?.trim() ||
          `Tailored scope from brief: "${clientMessages.slice(0, 140)}"`,
        deliverables:
          Array.isArray(parsed.quote?.deliverables) &&
          parsed.quote.deliverables.length > 0
            ? parsed.quote.deliverables
            : buildDeliverables(clientMessages, finalPrice),
        price: finalPrice,
        timeline: finalTimeline,
        status: 'PENDING_APPROVAL',
      };

      return NextResponse.json({
        readyForQuote: true,
        reply:
          parsed.reply?.trim() ||
          `Created a live deal proposal for ${quote.price} over ${quote.timeline} and brought the founder into the room.`,
        quote,
      });
    }

    return NextResponse.json({
      readyForQuote: false,
      reply:
        parsed.reply?.trim() ||
        'What are you looking to build, what is your target budget, and what timeline are you aiming for?',
    });
  } catch (err) {
    console.error('ai-qualify route error:', err);

    const clientText =
      messages
        .filter((m) => m.role === 'Client')
        .map((m) => m.text)
        .join(' ') || messages.map((m) => m.text).join(' ');

    const asksAboutServices =
      /\b(what do you offer|offered services|services|what can you build|capabilities|what do you do)\b/i.test(
        clientText
      );
    const budget = parseBudgetFromText(clientText);
    const timeline = parseTimelineFromText(clientText);
    const scopeReady = hasScopeSignal(clientText);

    if ((scopeReady && budget) || (budget && timeline)) {
      const finalPrice = budget || '$2,000';
      const finalTimeline = timeline || '2 weeks';
      return NextResponse.json({
        readyForQuote: true,
        reply: `Prepared a deal proposal for ${finalPrice} over ${finalTimeline} based on your brief, and opened the live room with the founder.`,
        quote: {
          projectTitle: buildTitle(clientText),
          summary: `Scoped around your brief: "${clientText.slice(0, 140)}"`,
          deliverables: buildDeliverables(clientText, finalPrice),
          price: finalPrice,
          timeline: finalTimeline,
          status: 'PENDING_APPROVAL',
        },
      });
    }

    if (asksAboutServices) {
      return NextResponse.json({
        readyForQuote: false,
        reply: `We offer: ${OFFERED_SERVICES.join('; ')}. Share what you want to build, your target budget, and your timeline to generate a deal quote.`,
      });
    }

    return NextResponse.json({
      readyForQuote: false,
      reply:
        'What are you looking to build, what is your target budget, and what timeline are you aiming for?',
    });
  }
}