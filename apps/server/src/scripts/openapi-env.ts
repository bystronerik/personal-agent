/**
 * Side-effect module, imported before `AppModule`. The document is derived from
 * decorators alone, so emitting it must not require a real tenant or a
 * reachable database — but `AppModule` still validates its configuration on
 * construction. Only absent values are filled; a configured `.env` still wins.
 */
const PLACEHOLDERS: Record<string, string> = {
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  AUTH0_DOMAIN: 'openapi.invalid',
  AUTH0_AUDIENCE: 'https://openapi.invalid',
}

for (const [name, value] of Object.entries(PLACEHOLDERS)) {
  if (!process.env[name]?.trim()) {
    process.env[name] = value
  }
}
