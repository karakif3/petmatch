import type { tr } from "./tr";

type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>;
};

/**
 * Draft catalog: its shape is type-checked, but English is intentionally not
 * released until the remaining hard-coded UI and native metadata are migrated.
 */
export const en: TranslationShape<typeof tr> = {
  brand: {
    motto: "For pets. For their people.",
    promise: "Pets make the introduction. You build the connection.",
    description:
      "A safe, pet-first community where playdates can grow into friendship or romance.",
  },
  onboarding: {
    connectionIntro:
      "Pets are your first shared interest. You can look only for a friend for your pet, or open your owner profile to meeting new people.",
  },
  discovery: {
    subtitle: "Discover pets and people who fit your life",
  },
  ownerConnection: {
    title: "Connection goal",
    nameHint: "Your name is required when you are open to meeting new people.",
    petOnlyTitle: "A friend for my pet only",
    petOnlyDetail:
      "Matching is based on pet compatibility; your owner profile follows your visibility setting.",
    openTitle: "I want to meet new people with my pet",
    openDetail:
      "You may be open to friendship or a romantic connection. This only signals openness to meeting; it never promises a particular relationship. Your name and owner photo appear in discovery.",
    prerequisitesError:
      "Meeting new people requires your name, an owner photo, and a profile visible in discovery.",
    badge: "Open to meeting",
    filterLabel: "Owners open to meeting",
    filterDetail:
      "Show people who are open to meeting through their pet for friendship or a romantic connection.",
  },
};
