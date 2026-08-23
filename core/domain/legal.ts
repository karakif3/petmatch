export const LEGAL_DOCUMENT_VERSION = "2026-08-22-v3";

export type LegalConfig = {
  controllerName: string;
  controllerAddress: string;
  supportEmail: string;
  privacyUrl: string;
  termsUrl: string;
  accountDeletionUrl: string;
  readyForRelease: boolean;
};

export function getLegalConfig(): LegalConfig {
  const controllerName = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ?? "";
  const controllerAddress = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER_ADDRESS?.trim() ?? "";
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ?? "";
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim() ?? "";
  const accountDeletionUrl = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL?.trim() ?? "";

  return {
    controllerName: controllerName || "[Veri sorumlusu ticari unvanı]",
    controllerAddress: controllerAddress || "[Veri sorumlusu tebligat adresi]",
    supportEmail: supportEmail || "[Destek ve KVKK başvuru e-postası]",
    privacyUrl,
    termsUrl,
    accountDeletionUrl,
    readyForRelease: Boolean(
      controllerName &&
        controllerAddress &&
        supportEmail &&
        privacyUrl &&
        termsUrl &&
        accountDeletionUrl,
    ),
  };
}
