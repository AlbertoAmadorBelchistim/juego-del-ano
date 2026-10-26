-- Esquema de la base de datos D1. Ejecutar una vez:
--   npx wrangler d1 execute juego-del-ano --remote --file=db/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL,
  shared  INTEGER NOT NULL DEFAULT 1,           -- 1 = los demás pueden ver su colección
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marks (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id   TEXT NOT NULL,                       -- "AAAA-slug", igual que en public/data
  estado    TEXT CHECK (estado IN ('tengo','quiero')),
  terminado INTEGER NOT NULL DEFAULT 0,
  completo  INTEGER NOT NULL DEFAULT 0,
  updated   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE IF NOT EXISTS fisica (              -- correcciones manuales de "edición física", compartidas
  game_id TEXT PRIMARY KEY,
  v       TEXT NOT NULL CHECK (v IN ('si','no','none')),
  by_user INTEGER REFERENCES users(id),
  updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Integración con la app Hogar (octubre de 2026)
ALTER TABLE marks ADD COLUMN progreso TEXT CHECK (progreso IN ('jugando','abandonado'));
CREATE TABLE IF NOT EXISTS hogares (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, binding TEXT NOT NULL);
ALTER TABLE users ADD COLUMN hogar_id INTEGER REFERENCES hogares(id);
ALTER TABLE users ADD COLUMN persona TEXT;        -- nombre que usa Hogar para listas («Quiero Alberto»)
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, updated TEXT NOT NULL DEFAULT (datetime('now')));

-- Títulos de juegos del catálogo que no son candidatos anuales (no están en hogar.json); los rellena la web al marcar
CREATE TABLE IF NOT EXISTS titulos (game_id TEXT PRIMARY KEY, titulo TEXT NOT NULL, slug TEXT, hids TEXT);  -- hids: ids de objetos de Hogar según la web (JSON)
