import { LEGAL_DOCUMENT_VERSION } from "../domain/legal";
import { requireSupabaseClient } from "./supabase.client";

export type LegalAcceptanceInput = {
  termsAccepted: boolean;
  privacyNoticeAcknowledged: boolean;
  locationConsent: boolean;
  publicProfileConsent: boolean;
};

export async function recordLegalAcceptances(
  input: LegalAcceptanceInput,
): Promise<void> {
  const sb = requireSupabaseClient();
  const { error } = await sb.rpc("record_legal_acceptances", {
    p_document_version: LEGAL_DOCUMENT_VERSION,
    p_terms_accepted: input.termsAccepted,
    p_privacy_notice_acknowledged: input.privacyNoticeAcknowledged,
    p_location_consent: input.locationConsent,
    p_public_profile_consent: input.publicProfileConsent,
  });
  if (error) throw error;
}

export async function recordOptionalConsent(
  consentType: "location_consent" | "public_profile_consent",
  accepted: boolean,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc(
    "record_optional_legal_consent",
    {
      p_consent_type: consentType,
      p_document_version: LEGAL_DOCUMENT_VERSION,
      p_accepted: accepted,
    },
  );
  if (error) throw error;
}
