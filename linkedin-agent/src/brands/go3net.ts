import type { BrandConfig } from "./types.js";

/**
 * Go3net Technologies Ltd — the technology company brand.
 * Positioning: a Nigerian tech company building serious software (including
 * Go3net Office, the cloud business operating system) and delivering IT
 * services that help African businesses run better.
 */
export const go3net: BrandConfig = {
  slug: "go3net",
  name: "Go3net Technologies Ltd",
  tagline: "Technology that moves your business forward.",
  website: "https://go3net.com.ng",
  linkedinOrgIdEnv: "LINKEDIN_ORG_ID_GO3NET",

  audience: [
    "Founders and executives of Nigerian SMEs",
    "HR, operations, and finance leaders evaluating business software",
    "IT decision-makers looking for a local implementation partner",
    "Tech talent interested in working at Go3net",
  ],

  voice: {
    personality:
      "A confident, competent engineering partner — practical, ambitious, proudly Nigerian, never gimmicky.",
    tone: ["professional", "clear", "optimistic", "authoritative"],
    always: [
      "Lead with the business outcome, then the technology",
      "Use concrete, local examples (naira figures, Nigerian business contexts)",
      "Write in plain English — explain any technical term you must use",
      "End with one clear call to action",
    ],
    neverSay: [
      "revolutionary",
      "game-changer",
      "world-class",
      "synergy",
      "we are pleased to announce", // corporate filler — say the news directly
    ],
  },

  pillars: [
    {
      key: "product",
      name: "Go3net Office",
      description:
        "Feature spotlights, use cases, and customer wins for the Go3net Office platform (HR, tasks, CRM, finance, and more in one system).",
      weight: 35,
      exampleTopics: [
        "How one dashboard replaces five spreadsheets for a 20-person company",
        "Running payroll and leave approvals from your phone",
        "Why multi-tenant SaaS matters for growing Nigerian businesses",
      ],
    },
    {
      key: "insights",
      name: "Business & tech insights",
      description:
        "Practical guidance on digital transformation, productivity, and running a modern business in Africa.",
      weight: 30,
      exampleTopics: [
        "Three signs your company has outgrown spreadsheets",
        "What 'the cloud' actually means for your data and NDPR compliance",
        "How to onboard a new employee in one day, not one week",
      ],
    },
    {
      key: "culture",
      name: "Company & culture",
      description:
        "Team stories, engineering culture, hiring, and milestones — the people behind the product.",
      weight: 20,
      exampleTopics: [
        "A day in the life of a Go3net engineer",
        "What we look for when we hire",
        "Milestone and anniversary posts",
      ],
    },
    {
      key: "services",
      name: "IT services",
      description:
        "Consulting, custom development, and infrastructure services Go3net delivers for clients.",
      weight: 15,
      exampleTopics: [
        "When to build custom software vs. buy off the shelf",
        "How we scope a software project so it ships on time",
      ],
    },
  ],

  hashtags: [
    "#Go3net",
    "#BusinessSoftware",
    "#NigerianTech",
    "#DigitalTransformation",
    "#SaaS",
    "#TechInAfrica",
  ],

  callsToAction: [
    "Book a free demo of Go3net Office at go3net.com.ng",
    "Follow Go3net for practical business technology insights",
    "Talk to our team about your next software project",
  ],

  timezone: "Africa/Lagos",
  postingSchedule: [
    { dayOfWeek: 1, time: "09:00" }, // Monday morning — insights
    { dayOfWeek: 3, time: "12:30" }, // Wednesday midday — product
    { dayOfWeek: 5, time: "10:00" }, // Friday — culture / lighter content
  ],
};

export default go3net;
