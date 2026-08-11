/**
 * Contract every brand file must satisfy. The agent reads nothing about a
 * brand from anywhere else — voice, cadence, and guardrails all live here.
 */

export interface ContentPillar {
  /** Stable key, stored on ContentIdea.pillar / Post.pillar. */
  key: string;
  name: string;
  description: string;
  /** Relative share of the content mix (weights are normalized across pillars). */
  weight: number;
  exampleTopics: string[];
}

export interface PostingSlot {
  /** 0 = Sunday … 6 = Saturday, in the brand's timezone. */
  dayOfWeek: number;
  /** 24h "HH:mm" in the brand's timezone. */
  time: string;
}

export interface BrandVoice {
  personality: string;
  tone: string[];
  /** Rules the drafter must follow. */
  always: string[];
  /** Hard guardrails — a draft containing any of these is rejected. */
  neverSay: string[];
}

export interface BrandConfig {
  /** Must match Brand.slug in the database and the filename. */
  slug: string;
  name: string;
  tagline: string;
  website: string;
  /** Env var that holds the LinkedIn organization id (never the id itself). */
  linkedinOrgIdEnv: string;

  audience: string[];
  voice: BrandVoice;
  pillars: ContentPillar[];

  /** 3–5 get appended to each post; the drafter picks the most relevant. */
  hashtags: string[];
  callsToAction: string[];

  timezone: string;
  postingSchedule: PostingSlot[];
}
