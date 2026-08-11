// BrandConfig — the contract both brand files satisfy, inferred from
// go3net.ts and speedfi.ts. The agent reads brand voice from nowhere else.

export interface BrandVoice {
  traits: string[];
  /// Style instructions passed verbatim to the generator.
  guidance: string[];
}

export interface BrandPillar {
  /// Stable identifier, mirrored into Pillar.key at seed time.
  key: string;
  name: string;
  /// Relative sampling weight, mirrored into Pillar.weight at seed time.
  weight: number;
  /// Pillar-specific prompt context for the generator.
  brief: string;
}

export interface BrandCta {
  /// Rotate between these; never the same CTA twice in one week.
  options: string[];
  /// Pillar keys whose posts may skip the CTA entirely.
  omitOnPillars: string[];
}

export interface BrandFormat {
  /// [min, max] word count for a post body.
  targetWords: [number, number];
  /// The hook must land within this many characters — LinkedIn's fold.
  hookMaxChars: number;
  /// [min, max] hashtags per post.
  hashtags: [number, number];
  preferredHashtags: string[];
  cta: BrandCta;
}

export interface BrandGuardrails {
  /// Phrases that force a rejection and regeneration if they survive.
  banned: string[];
  /// Hard rules included verbatim in the generation prompt.
  rules: string[];
}

/// Product-specific facts the generator may reference (SPEEDFI's assistant
/// Zino, live channels). Optional — Go3net has none.
export interface ProductNotes {
  assistantName: string;
  channels: string[];
}

export interface BrandConfig {
  /// Matches Brand.slug in the database and the filename.
  slug: string;
  displayName: string;

  positioning: string;
  promise: string;
  audience: string;

  voice: BrandVoice;
  productNotes?: ProductNotes;
  pillars: BrandPillar[];
  format: BrandFormat;
  guardrails: BrandGuardrails;
}
