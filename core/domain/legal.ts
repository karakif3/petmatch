export const LEGAL_DOCUMENT_VERSION = "2026-07-29-v2";

export type LegalConfig = {
  controllerName: string;
  controllerAddress: string;
  supportEmail: string;
  readyForRelease: boolean;
};

export function getLegalConfig(): LegalConfig {
  const controllerName = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ?? "";
  const controllerAddress = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER_ADDRESS?.trim() ?? "";
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

  return {
    controllerName: controllerName || "[Veri sorumlusu ticari unvanı]",
    controllerAddress: controllerAddress || "[Veri sorumlusu tebligat adresi]",
    supportEmail: supportEmail || "[Destek ve KVKK başvuru e-postası]",
    readyForRelease: Boolean(controllerName && controllerAddress && supportEmail),
  };
}
