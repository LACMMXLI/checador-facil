export const config = {
  get port() { return Number(process.env.API_PORT || 4000); },
  get appUrl() { return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''); },
  get secret() { return process.env.APP_SECRET || ''; },
  get cookieSecure() { return process.env.COOKIE_SECURE === 'true'; },
  get requireEmailVerification() { return process.env.REQUIRE_EMAIL_VERIFICATION !== 'false'; },
  get platformRequireMfa() { return process.env.PLATFORM_REQUIRE_MFA === 'true'; },
  get isProd() { return process.env.NODE_ENV === 'production'; },
  get isTest() { return process.env.NODE_ENV === 'test'; },
};

export function assertConfig() {
  if (config.secret.length < 32) throw new Error('APP_SECRET debe tener al menos 32 caracteres');
  if (config.isProd && !config.cookieSecure) throw new Error('En producción COOKIE_SECURE debe ser true (HTTPS)');
}
