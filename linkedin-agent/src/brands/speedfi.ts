import type { BrandConfig } from "./types.js";

/**
 * SpeedFi — Go3net's internet/connectivity brand.
 * Positioning: fast, reliable, affordable internet for homes and businesses.
 * Warmer and more consumer-facing than the Go3net corporate brand.
 */
export const speedfi: BrandConfig = {
  slug: "speedfi",
  name: "SpeedFi",
  tagline: "Fast internet. No stories.",
  website: "https://go3net.com.ng/speedfi",
  linkedinOrgIdEnv: "LINKEDIN_ORG_ID_SPEEDFI",

  audience: [
    "Households and remote workers who need dependable internet",
    "Small businesses, shops, and offices choosing an ISP",
    "Estate managers and property developers bundling connectivity",
    "Gamers and streamers who care about latency, not just speed",
  ],

  voice: {
    personality:
      "The straight-talking friend who actually delivers — energetic, relatable, a little playful, always honest about what customers get.",
    tone: ["friendly", "direct", "energetic", "trustworthy"],
    always: [
      "Talk about real customer situations (video calls, streaming, POS uptime, remote work)",
      "Be specific about plans, speeds, and coverage — no vague promises",
      "Keep sentences short and skimmable",
      "Make it easy to act: one link or one number per post",
    ],
    neverSay: [
      "unlimited*", // no asterisk plans — if it has conditions, state them
      "blazing-fast",
      "best in the world",
      "network issues are beyond our control", // own problems, don't deflect
    ],
  },

  pillars: [
    {
      key: "plans",
      name: "Plans & offers",
      description:
        "Packages, pricing, coverage expansions, and promos — always concrete and honest.",
      weight: 30,
      exampleTopics: [
        "What you can actually do on each SpeedFi plan",
        "New coverage area announcements",
        "Referral and installation promos",
      ],
    },
    {
      key: "reliability",
      name: "Reliability & support",
      description:
        "Uptime, honest service updates, and how SpeedFi handles support — trust is the product.",
      weight: 25,
      exampleTopics: [
        "What we do when the network has a bad day",
        "How fast our average support ticket gets resolved",
        "Meet the field team keeping your connection up",
      ],
    },
    {
      key: "lifestyle",
      name: "Connected life & work",
      description:
        "Remote work, streaming, gaming, smart homes, and small-business connectivity tips.",
      weight: 30,
      exampleTopics: [
        "A remote worker's checklist for interview-proof internet",
        "How much data a Champions League stream really uses",
        "Keeping your POS online when it matters most",
      ],
    },
    {
      key: "community",
      name: "Customers & community",
      description:
        "Customer spotlights, testimonials, and neighbourhood stories from areas SpeedFi serves.",
      weight: 15,
      exampleTopics: [
        "Customer story: running an online store on SpeedFi",
        "Estate spotlight: bringing a whole community online",
      ],
    },
  ],

  hashtags: [
    "#SpeedFi",
    "#FastInternet",
    "#NigerianISP",
    "#RemoteWork",
    "#StayConnected",
    "#InternetInNigeria",
  ],

  callsToAction: [
    "Check if SpeedFi covers your area — link in the comments",
    "DM us your location for a same-week installation quote",
    "Tag someone whose internet keeps embarrassing them",
  ],

  timezone: "Africa/Lagos",
  postingSchedule: [
    { dayOfWeek: 2, time: "08:30" }, // Tuesday morning commute
    { dayOfWeek: 4, time: "17:00" }, // Thursday after-work scroll
    { dayOfWeek: 6, time: "11:00" }, // Saturday — lifestyle content
  ],
};

export default speedfi;
