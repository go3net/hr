import type { BrandConfig } from "./types";

export const go3net: BrandConfig = {
  slug: "go3net",
  displayName: "Go3net Technologies",

  positioning:
    "ICT consultancy and software engineering — bridging today's challenges with " +
    "tomorrow's innovations",
  promise: "Link to the future",

  audience:
    "Two audiences on one Page. First: Nigerian business decision-makers — MDs, " +
    "operations heads, school proprietors, facility managers — evaluating who to " +
    "trust with software, networks or IT support. Second: young Nigerians looking " +
    "for a route into tech through training. Write for the first by default; the " +
    "training pillar speaks to the second.",

  voice: {
    traits: [
      "professional",
      "credible",
      "plain-spoken",
      "generous with expertise",
      "quietly confident",
    ],
    guidance: [
      "Consultancy voice, not startup voice. Measured. No hype, no exclamation marks.",
      "Demonstrate competence by explaining something properly, not by claiming to be a leader.",
      "Assume the reader is intelligent but not technical. Define jargon the first time.",
      "Nigerian context is the differentiator — power, bandwidth, cost in naira, " +
        "vendor availability, what actually survives in a Lagos office.",
      "Values show through examples, never through stating them. Never write the " +
        "words 'integrity', 'excellence' or 'professionalism' in a post.",
    ],
  },

  pillars: [
    {
      key: "technical_education",
      name: "Technical Education",
      weight: 30,
      brief:
        "Explain one technical concept a business owner keeps hearing but has never " +
        "had explained straight — what a VPN actually does, why their email lands in " +
        "spam, what cloud backup costs and does not cover. Genuinely useful, no pitch.",
    },
    {
      key: "case_and_capability",
      name: "Case & Capability",
      weight: 25,
      brief:
        "What we built or fixed and what it changed for the client. Anonymise unless " +
        "the client has agreed to be named in the topic seed. Focus on the problem and " +
        "the decision, not the tech stack.",
    },
    {
      key: "security_and_risk",
      name: "Security & Risk",
      weight: 20,
      brief:
        "Practical protection for Nigerian businesses — invoice fraud, staff offboarding, " +
        "phishing that actually circulates locally, backups. Never fear-mongering; every " +
        "post ends with something the reader can do this week.",
    },
    {
      key: "training",
      name: "Training & Talent",
      weight: 15,
      brief:
        "The training institute — cohorts, what students build, routes into tech, honest " +
        "advice about learning to code. Speaks to a younger audience, so the register " +
        "can loosen slightly, but never becomes salesy.",
    },
    {
      key: "company",
      name: "Company & Industry",
      weight: 10,
      brief:
        "Milestones, team, certifications, and a considered view on where African ICT is " +
        "heading. This is the only pillar where Go3net talks about itself directly.",
    },
  ],

  format: {
    targetWords: [120, 200] as [number, number],
    hookMaxChars: 140,
    hashtags: [2, 4] as [number, number],
    preferredHashtags: [
      "#ICTNigeria",
      "#Cybersecurity",
      "#TechInAfrica",
      "#DigitalTransformation",
    ],
    cta: {
      options: [
        "If this is on your list this quarter, send us a message.",
        "Questions about your own setup? Comment and I'll answer.",
        "go3net.com.ng",
      ],
      omitOnPillars: ["technical_education", "security_and_risk"],
    },
  },

  guardrails: {
    banned: [
      "leading provider",
      "one-stop solution",
      "cutting-edge",
      "state-of-the-art",
      "leverage",
      "synergy",
      "in today's digital age",
      "we are excited to announce",
    ],
    rules: [
      "Never name a client without explicit permission recorded in the topic seed.",
      "Never publish specifics that expose a client's infrastructure — no IPs, vendors, " +
        "topology, or details of a breach that could identify them.",
      "Never quote a price or delivery timeline. Those are conversations, not posts.",
      "No em-dashes. No emojis in Page voice except in the training pillar, and at most one.",
      "Do not claim certifications, partnerships or awards not confirmed in the seed.",
    ],
  },
};
