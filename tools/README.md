# Actualización de los candidatos 2026

Todos los pasos se ejecutan desde la carpeta tools/.

1. Metacritic (desde el contenedor, sin navegador):
   curl el finder: https://backend.metacritic.com/finder/metacritic/web?sortBy=-metaScore&productType=games&releaseYearMin=2026&releaseYearMax=2026&offset={0,24,48}&limit=24&apiKey=1MOZgmNFxvmljaQR1X9KAij9Mo4xAY3u
   Guardar en mc2026.json una lista de {title,slug,date,score,reviews,platforms[],img} (img = image.bucketPath; score/reviews = criticScoreSummary).
2. Premios: revisar en la web nominados nuevos (The Game Awards 2026 -> Game of the Year; Golden Joystick Ultimate Game of the Year; ganadores Golden Joystick 11-nov) y actualizar awards2026.json (games: {titulo: {"TGA":"nom"|"won", "Golden Joystick":...}}, notes, upcoming, labels).
3. Backloggd (navegador integrado del ordenador de Alberto, pestaña en backloggd.com): ejecutar backloggd.js, luego BLTOOLS.run(2026, <títulos: top 20 de mc2026 con >=25 críticas + todos los de awards2026.games>), esperar a BLTOOLS.state.done, y copiar BLTOOLS.output() a bl_top.txt y bl_lookup.txt.
4. python3 build2026.py  -> docs/*.json (incluye edición física detectada en Wikipedia; las correcciones manuales viven en la tabla "fisica" de D1 y no se tocan)
5. python3 pack2026.py  -> public/data/y2026.json
6. git add ../public/data/y2026.json awards2026.json && git commit -m "2026: actualización semanal" && git push (Cloudflare Pages redespliega solo).
