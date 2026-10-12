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
