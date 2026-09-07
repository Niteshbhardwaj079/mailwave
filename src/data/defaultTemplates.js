// ---------------------------------------------------------------------------
// The 14 built-in default (master) templates.
//
// Seeded once (server/src/db/seed.js), marked is_default:true, and never
// editable in place — TemplatesPage/TemplateEditorPage always fork a copy
// first ("Use this template" -> duplicate -> edit the copy). Real,
// purpose-written copy per template, not lorem ipsum.
//
// Placeholder images: every `{{PLACEHOLDER_BASE}}` token below is resolved by
// resolveDefaultTemplateSchema() into `<publicUrl>/template-placeholders/
// <slug>.png` — real PNG files committed to server/public/template-
// placeholders/, generated once by server/.scratch/generate_placeholders.mjs.
// Deliberately not an external placeholder service or an inline SVG/data-URI:
// those are stripped or render unreliably in Gmail/Outlook/Apple Mail, and an
// external service can go offline. A real, app-hosted PNG never can.
// ---------------------------------------------------------------------------
import { renderTemplateHtml } from './templateBuilder.js';

export const DEFAULT_TEMPLATE_CATEGORIES = [
  'Promotions & Offers',
  'Product & Launch',
  'Newsletter & Updates',
  'Festival & Events',
  'Business & Leads',
  'Engagement',
  'Onboarding & Appreciation',
];

function img(slug, alt) {
  return { type: 'image', url: `{{PLACEHOLDER_BASE}}/${slug}.png`, alt };
}

function p(text) {
  return { type: 'paragraph', text };
}

function btn(label, urlVar) {
  return { type: 'button', label, url: `{{${urlVar}}}` };
}

const STANDARD_FOOTER = {
  footerText: '{{company}}',
  contactDetails: 'Questions? Write to {{support_email}}',
  unsubscribeText: 'Unsubscribe from these emails',
};

export const DEFAULT_TEMPLATES = [
  // --- Promotions & Offers ---------------------------------------------------
  {
    id: 'tpl_default_promotional_offer',
    slug: 'promotional-offer',
    name: 'Promotional Offer',
    category: 'Promotions & Offers',
    subject: 'A special offer just for you, {{name}}',
    schema: {
      accentColor: '#dc2626',
      brandName: '{{app_name}}',
      heading: 'A special offer, just for you',
      blocks: [
        img('promotional-offer', 'Promotional offer'),
        p('Hi {{name}}, for a limited time we are giving our subscribers an exclusive deal — no fine print, no waiting in line.'),
        p('Use the button below before this offer closes.'),
        btn('Claim the offer', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_special_deal',
    slug: 'special-deal',
    name: 'Special Deal',
    category: 'Promotions & Offers',
    subject: '{{name}}, this deal will not last long',
    schema: {
      accentColor: '#ea580c',
      brandName: '{{app_name}}',
      heading: 'A deal worth acting on today',
      blocks: [
        img('special-deal', 'Special deal'),
        p('Hello {{name}}, we put together a special deal for a short window only. Once it ends, pricing goes back to normal.'),
        p('Grab it before the timer runs out.'),
        btn('See the deal', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_seasonal_campaign',
    slug: 'seasonal-campaign',
    name: 'Seasonal Campaign',
    category: 'Promotions & Offers',
    subject: 'Our seasonal picks are here, {{name}}',
    schema: {
      accentColor: '#0891b2',
      brandName: '{{app_name}}',
      heading: 'This season\'s picks, ready for you',
      blocks: [
        img('seasonal-campaign', 'Seasonal collection'),
        p('Hi {{name}}, the season has changed and so has what we have to offer. Take a look at what is new.'),
        p('New arrivals do not stay around forever — have a look while it is fresh.'),
        btn('Browse now', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Product & Launch -------------------------------------------------------
  {
    id: 'tpl_default_product_launch',
    slug: 'product-launch',
    name: 'Product Launch',
    category: 'Product & Launch',
    subject: 'Introducing something new, {{name}}',
    schema: {
      accentColor: '#4f46e5',
      brandName: '{{app_name}}',
      heading: 'Something new just launched',
      blocks: [
        img('product-launch', 'New product'),
        p('Hi {{name}}, we have been building something for a while, and it is finally ready. Here is a first look.'),
        p('We built it because our customers kept asking for it — we hope it makes your day easier.'),
        btn('See what is new', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Newsletter & Updates ----------------------------------------------------
  {
    id: 'tpl_default_newsletter',
    slug: 'newsletter',
    name: 'Newsletter',
    category: 'Newsletter & Updates',
    subject: 'Your {{app_name}} update, {{name}}',
    schema: {
      accentColor: '#16a34a',
      brandName: '{{app_name}}',
      heading: 'What has been happening',
      blocks: [
        img('newsletter', 'Newsletter'),
        p('Hi {{name}}, here is a quick round-up of what has been going on since our last note to you.'),
        p('As always, thank you for staying subscribed — more soon.'),
        btn('Read the full update', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_company_announcement',
    slug: 'company-announcement',
    name: 'Company Announcement',
    category: 'Newsletter & Updates',
    subject: 'An update from {{company}}',
    schema: {
      accentColor: '#1d4ed8',
      brandName: '{{app_name}}',
      heading: 'An announcement from us',
      blocks: [
        img('company-announcement', 'Company announcement'),
        p('Hello {{name}}, we wanted you to hear this news directly from us before anywhere else.'),
        p('Thank you for being part of our journey.'),
        btn('Read more', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Festival & Events --------------------------------------------------------
  {
    id: 'tpl_default_festival_campaign',
    slug: 'festival-campaign',
    name: 'Festival Campaign',
    category: 'Festival & Events',
    subject: 'Celebrate the festival with {{app_name}}, {{name}}',
    schema: {
      accentColor: '#f59e0b',
      brandName: '{{app_name}}',
      heading: 'Wishing you a wonderful festival',
      blocks: [
        img('festival-campaign', 'Festival celebration'),
        p('Hi {{name}}, the festive season has arrived — and we have put together something special to celebrate it with you.'),
        p('Warm wishes from all of us at {{company}}.'),
        btn('See the festival specials', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_event_promotion',
    slug: 'event-promotion',
    name: 'Event Promotion',
    category: 'Festival & Events',
    subject: 'You are invited, {{name}}',
    schema: {
      accentColor: '#7c3aed',
      brandName: '{{app_name}}',
      heading: 'You are invited',
      blocks: [
        img('event-promotion', 'Event'),
        p('Hi {{name}}, we are hosting an event and would love to have you there. Seats are limited, so reserve yours early.'),
        p('We will share the full agenda closer to the date.'),
        btn('Reserve my seat', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Business & Leads -----------------------------------------------------
  {
    id: 'tpl_default_business_promotion',
    slug: 'business-promotion',
    name: 'Business Promotion',
    category: 'Business & Leads',
    subject: 'How {{company}} can help your business',
    schema: {
      accentColor: '#0f766e',
      brandName: '{{app_name}}',
      heading: 'Built to help your business grow',
      blocks: [
        img('business-promotion', 'Business services'),
        p('Hello {{name}}, businesses like yours use {{app_name}} to save time and grow faster. Here is how it can help you too.'),
        p('Happy to walk you through it whenever suits you.'),
        btn('Talk to us', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_lead_generation',
    slug: 'lead-generation',
    name: 'Lead Generation',
    category: 'Business & Leads',
    subject: 'A resource worth your time, {{name}}',
    schema: {
      accentColor: '#2563eb',
      brandName: '{{app_name}}',
      heading: 'A resource worth your time',
      blocks: [
        img('lead-generation', 'Free resource'),
        p('Hi {{name}}, we put together a free resource that a lot of people in your position have found useful.'),
        p('No strings attached — just download it and see if it helps.'),
        btn('Get it now', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Engagement -------------------------------------------------------------
  {
    id: 'tpl_default_customer_engagement',
    slug: 'customer-engagement',
    name: 'Customer Engagement',
    category: 'Engagement',
    subject: 'We would love to hear from you, {{name}}',
    schema: {
      accentColor: '#db2777',
      brandName: '{{app_name}}',
      heading: 'We would love to hear from you',
      blocks: [
        img('customer-engagement', 'Customer engagement'),
        p('Hi {{name}}, you have been with us a while and we would genuinely like to know how things are going.'),
        p('Your answer helps us build a better experience for everyone.'),
        btn('Share your thoughts', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_re_engagement',
    slug: 're-engagement',
    name: 'Re-engagement',
    category: 'Engagement',
    subject: 'We have missed you, {{name}}',
    schema: {
      accentColor: '#9333ea',
      brandName: '{{app_name}}',
      heading: 'We have missed you',
      blocks: [
        img('re-engagement', 'Welcome back'),
        p('Hi {{name}}, it has been a while since we last heard from you, and we wanted to check in.'),
        p('Come back and see what is changed — we think you will like it.'),
        btn('Take another look', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },

  // --- Onboarding & Appreciation -------------------------------------------
  {
    id: 'tpl_default_welcome_campaign',
    slug: 'welcome-campaign',
    name: 'Welcome Campaign',
    category: 'Onboarding & Appreciation',
    subject: 'Welcome to {{app_name}}, {{name}}',
    schema: {
      accentColor: '#059669',
      brandName: '{{app_name}}',
      heading: 'Welcome — glad you are here',
      blocks: [
        img('welcome-campaign', 'Welcome'),
        p('Hi {{name}}, thank you for joining us. Here is a quick starting point to help you get the most out of {{app_name}}.'),
        p('If you ever have a question, just reply to this email.'),
        btn('Get started', 'subscribe_url'),
      ],
      ...STANDARD_FOOTER,
    },
  },
  {
    id: 'tpl_default_thank_you',
    slug: 'thank-you-appreciation',
    name: 'Thank You / Appreciation',
    category: 'Onboarding & Appreciation',
    subject: 'Just a thank you, {{name}}',
    schema: {
      accentColor: '#ca8a04',
      brandName: '{{app_name}}',
      heading: 'Thank you',
      blocks: [
        img('thank-you-appreciation', 'Thank you'),
        p('Hi {{name}}, we simply wanted to say thank you for being part of {{app_name}}. It genuinely means a lot to us.'),
        p('We will keep working to make this worth your time.'),
      ],
      ...STANDARD_FOOTER,
    },
  },
];

/** Placeholder tokens ko is deployment ke asli, app-hosted PNG URL se badalta hai. */
export function resolveDefaultTemplateSchema(entry, placeholderBaseUrl) {
  const json = JSON.stringify(entry.schema).replace(/\{\{PLACEHOLDER_BASE\}\}/g, placeholderBaseUrl);
  return JSON.parse(json);
}

export function renderDefaultTemplateHtml(entry, placeholderBaseUrl) {
  return renderTemplateHtml(resolveDefaultTemplateSchema(entry, placeholderBaseUrl));
}
