# Catálogo de todos los tiempos y años 1998–2013

Todo se ejecuta desde la raíz del repositorio. Los datos de entrada viven en `tools/catalogo/datos/`.

| Fichero | Qué es | Cómo se refresca |
|---|---|---|
| `mc_all.json` | Metacritic, todo lo que tiene ≥75 (unos 6.200 juegos) | `python3 tools/catalogo/mc_all.py` (API pública de Metacritic, ~4 min) |
| `blx.json` | Fichas de Backloggd leídas desde el navegador: `{slug: {title, n, avg, year, genres, pl, cover, fecha}}` | Navegador integrado del ordenador de Alberto (ver abajo) |
| `bl_2025.csv` | Backloggd de junio de 2025 (cuadernos de Colab); respaldo | No se refresca |
| `igdb_map.csv` | Cruce Metacritic → slug de IGDB/Backloggd (cuadernos de Colab) | No se refresca |
| `awards_1998_2013.json` | GOTY de VGA, DICE, GDC, BAFTA y Golden Joystick 1998–2013 (Wikipedia) | Fijo |
| `hogar.json`, `hogar_bl.json` | Inventario de Hogar y fichas de Backloggd de los juegos de casa que no estaban | Al añadir juegos en Hogar |
| `mc_extra.json` | Fichas de Metacritic por debajo de 75 que hacen falta (juegos de casa, premiados) | A mano o con la búsqueda de Metacritic |

Después: `python3 tools/catalogo/build_catalogo.py` genera `public/data/catalogo.json`, añade 1998–2013 a `public/data/games.json` y los premios a `public/data/other.json`.

## Índice del catálogo

- 50 % Metacritic, ajustado hacia 78 como si tuviera 8 críticas más.
- 50 % Backloggd ×20, ajustado hacia la media del catálogo como si tuviera 1.000 votos más.
- Si falta una de las dos, esa mitad vale la media: una sola nota no basta para colarse arriba.
- Grouvee, Glitchwave y usuarios de Metacritic no entran: con los datos de 2025, Backloggd–Grouvee r=0,78 y Backloggd–Glitchwave r=0,73 (redundantes y con 5–10 veces menos votos).
- Must play = Metacritic ≥90 con ≥15 críticas.

## Refresco de Backloggd (rotación)

En una pestaña de backloggd.com del navegador integrado, se pega la función `getStats` de `tools/backloggd.js` y se leen las fichas más antiguas de `blx.json` (unas 400 por semana, ~15 min). Así cada ficha se renueva cada ~6 semanas sin cargar la web.
