-- mars-ari-lms database initialization
-- Creates separate schema for Keycloak to share the same Postgres instance

CREATE SCHEMA IF NOT EXISTS keycloak;

-- Extensions (also declared in Prisma schema, added here for init order)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant keycloak schema permissions to marsari db user
GRANT ALL PRIVILEGES ON SCHEMA keycloak TO marsari;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA keycloak TO marsari;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA keycloak TO marsari;
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak GRANT ALL ON TABLES TO marsari;
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak GRANT ALL ON SEQUENCES TO marsari;
