#!/usr/bin/env bash
set -Eeuo pipefail

# Creates the database + login role of every service whose password is set.
# docker-compose.yml runs one instance per service and passes only that
# service's password; compose.infra.yml (native development) runs a single
# instance and passes all four. Runs only when PGDATA is empty (first start).
#
# Izolasyon PostgreSQL seviyesinde zorlanir:
#   - Her database'in sahibi kendi servis rolüdür.
#   - CONNECT yetkisi PUBLIC'ten alinir, yalnizca sahibine verilir.
#   - Roller NOSUPERUSER/NOCREATEDB/NOCREATEROLE'dur.
# Sonuc: identity_app, fraudcell_transaction'a BAGLANAMAZ. Cross-database query
# PostgreSQL'de zaten mumkun degildir; buna ek olarak baglanti da kapatilmistir.

create_role_and_database() {
  local role_name="$1"
  local database_name="$2"
  local role_password="$3"

  psql --set=ON_ERROR_STOP=1 \
    --set=role_name="$role_name" \
    --set=database_name="$database_name" \
    --set=role_password="$role_password" \
    --username "$POSTGRES_USER" \
    --dbname postgres <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name') \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'role_name', :'role_password') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'role_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name') \gexec

REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT ALL ON DATABASE :"database_name" TO :"role_name";
SQL
}

if [[ -n "${IDENTITY_DB_PASSWORD:-}" ]]; then create_role_and_database identity_app fraudcell_identity "$IDENTITY_DB_PASSWORD"; fi
if [[ -n "${TRANSACTION_DB_PASSWORD:-}" ]]; then create_role_and_database transaction_app fraudcell_transaction "$TRANSACTION_DB_PASSWORD"; fi
if [[ -n "${GAMIFICATION_DB_PASSWORD:-}" ]]; then create_role_and_database gamification_app fraudcell_gamification "$GAMIFICATION_DB_PASSWORD"; fi
if [[ -n "${AI_DB_PASSWORD:-}" ]]; then create_role_and_database ai_app fraudcell_ai "$AI_DB_PASSWORD"; fi

# Bakim database'i de uygulama rollerine kapatilir; yalnizca superuser kullanir.
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL
