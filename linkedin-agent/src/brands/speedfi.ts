import type { BrandConfig } from "./types";

export const speedfi: BrandConfig = {
  slug: "speedfi",
  displayName: "SPEEDFI",

  positioning: "Africa's WhatsApp-first commerce operating system",
  promise: "Sell Online. Close on WhatsApp.",

  audience:
    "Nigerian and African small business owners selling on WhatsApp and Instagram — " +
    "fashion vendors, food businesses, gadget sellers, service providers. Mostly " +
    "running the business alone or with one or two staff. Phone-first. Time-poor. " +
    "Skeptical of software that promises a lot and delivers admin work.",

  voice: {
    traits: ["simple", "conversational", "solution-focused", "confident", "human"],
    guidance: [
      "Write the way a smart friend who runs a business would talk, not the way a brand writes.",
      "Short sentences. One idea per line. Plenty of white space — this is read on a phone.",
      "Lead with the vendor's problem, not the product. The product is the second half of the post.",
      "Concrete over clever. 'You lost the sale because you replied at 11pm' beats 'seamless customer engagement'.",
      "Naira amounts, Nigerian business realities, real scenarios. No generic Silicon Valley examples.",
    ],
  },

  // The AI sales assistant inside SPEEDFI. Refer to Zino by name when the post
  // is about the assistant; do not personify Zino elsewhere.
  productNotes: {
    assistantName: "Zino",
    channels: ["WhatsApp Cloud API", "Paystack checkout"],
  },

  pillars: [
    {
      key: "business_education",
      name: "Business Education",
      weight: 30,
      brief:
        "Teach something a vendor can use today, with no mention of SPEEDFI until " +
        "the last line at most. Pricing, follow-up, handling 'how much?', converting " +
        "DMs, stock, repeat customers. Must be useful even to someone who never signs up.",
    },
    {
      key: "product_education",
      name: "Product Education",
      weight: 25,
      brief:
        "Show one specific thing SPEEDFI does and what changes for the vendor because " +
        "of it. One feature per post. Describe the outcome, not the settings screen.",
    },
    {
      key: "problem_solution",
      name: "Problem to Solution",
      weight: 20,
      brief:
        "Open on a painful, recognisable moment — the customer who ghosted, the order " +
        "lost in 200 unread chats — then show the way out. Name the pain precisely " +
        "enough that the reader feels caught.",
    },
    {
      key: "customer_success",
      name: "Customer Success",
      weight: 15,
      brief:
        "A real vendor, a real before and after. Never invent a customer, a quote, or " +
        "a number. If no verified story is supplied in the topic seed, skip this pillar " +
        "and pick another.",
    },
    {
      key: "brand_community",
      name: "Brand & Community",
      weight: 10,
      brief:
        "Team, milestones, what we believe about African commerce, behind the scenes. " +
        "Warm and human. This is the pillar where personality is allowed to run.",
    },
  ],

  format: {
    targetWords: [90, 160] as [number, number],
    hookMaxChars: 140, // LinkedIn truncates around here — the hook must land above the fold
    hashtags: [2, 4] as [number, number],
    preferredHashtags: [
      "#WhatsAppCommerce",
      "#SmallBusinessNigeria",
      "#SellOnWhatsApp",
      "#AfricanBusiness",
    ],
    cta: {
      // Rotate. Never use the same CTA twice in one week.
      options: [
        "Start free at speedfi.com",
        "Tell me your biggest WhatsApp headache in the comments.",
        "Link in the comments if you want to try it.",
      ],
      // Education posts earn trust; they do not always need a CTA.
      omitOnPillars: ["business_education"],
    },
  },

  guardrails: {
    banned: [
      "revolutionary",
      "game-changer",
      "unlock",
      "leverage",
      "seamless",
      "cutting-edge",
      "in today's fast-paced world",
      "dear entrepreneurs",
    ],
    rules: [
      "Never state a customer count, revenue figure, growth percentage or testimonial " +
        "unless it appears verbatim in the topic seed. No estimates, no 'thousands of'.",
      "Never claim a feature that is not confirmed live.",
      "No em-dashes. No emoji walls — at most two emojis, and only where a vendor " +
        "would actually use one.",
      "Do not open with a one-word sentence followed by a line break. It is the most " +
        "recognisable AI-LinkedIn tic there is.",
      "Do not name or compare against competitors.",
    ],
  },
};
