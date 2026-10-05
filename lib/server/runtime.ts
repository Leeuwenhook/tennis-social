export type RuntimeEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_SECURE?: string;
  EMAIL_FROM?: string;
  CRON_SECRET?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_USERNAME_2?: string;
  ADMIN_PASSWORD_2?: string;
  ADMIN_SESSION_SECRET?: string;
  ENABLE_LEGACY_LOYALTY_COUPONS?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_USERNAME_2: process.env.ADMIN_USERNAME_2,
    ADMIN_PASSWORD_2: process.env.ADMIN_PASSWORD_2,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    ENABLE_LEGACY_LOYALTY_COUPONS: process.env.ENABLE_LEGACY_LOYALTY_COUPONS,
  };
}
