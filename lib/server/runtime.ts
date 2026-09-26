export type RuntimeEnv = {
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
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
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
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
