export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Legacy Manus Forge variables. Keep them as optional fallback only.
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Self-hosted OpenAI scanner variables.
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",

  // Stripe subscription billing. Provisioned automatically by the platform;
  // live keys are swapped in from Settings → Payment after KYC.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",

  // Team Signals — Telegram bot ingestion (server/telegram.ts). The webhook
  // only activates when BOTH the bot token and the shared webhook secret are
  // set; the channel id is an optional extra filter so only the owner's
  // private channel is ever ingested.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID ?? "",
  publicUrl: process.env.PUBLIC_URL ?? "https://ultimatradingjournal.com",
};
