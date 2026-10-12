# El mejor juego de cada año

Web con los candidatos a juego del año de 2014 a 2026: nominados de The Game Awards, DICE, GDC, BAFTA y Golden Joystick, más el top 20 anual de Metacritic y Backloggd, ordenados por un índice que mezcla crítica, jugadores y premios. Cada persona que entra tiene su propia colección (Tengo, Quiero, Terminado, 100%), puede ver las colecciones que otros comparten y comparar la suya con ellas.

Funciona en **Cloudflare Pages** (web estática + Functions) con una base de datos **D1**, y el acceso se controla con **Cloudflare Access** (login con código por correo, sin contraseñas). Todo cabe en el plan gratuito.

```
public/            web estática (index.html, app.js, sprites de carátulas, data/*.json)
functions/api/     API: /api/state, /api/marks, /api/fisica, /api/me
db/schema.sql      tablas de D1
db/seed.sql        tu colección y tus correcciones importadas del artefacto de Claude
tools/             scripts para recalcular los candidatos de 2026
```

## Puesta en marcha (una vez, unos 15 minutos)

### 1. Crear la base de datos

En el panel de Cloudflare: **Storage & Databases → D1 → Create database**, nombre `juego-del-ano`. Copia el **Database ID** que aparece y pégalo en `wrangler.toml` (línea `database_id`), y sube el cambio.

Luego, en la pestaña **Console** de esa base de datos, pega y ejecuta el contenido de `db/schema.sql` y después el de `db/seed.sql`. Si prefieres terminal:

```
npx wrangler login
npx wrangler d1 execute juego-del-ano --remote --file=db/schema.sql
npx wrangler d1 execute juego-del-ano --remote --file=db/seed.sql
```

`seed.sql` asigna tu colección actual (125 juegos) al correo `belchistim@gmail.com`. Si vas a entrar con otro correo, cámbialo en la segunda línea del fichero antes de ejecutarlo.

### 2. Crear la web

**Workers & Pages → Create → Pages → Connect to Git**, elige este repositorio.
- Framework preset: *None*
- Build command: vacío
- Build output directory: `public`

Tras el primer despliegue, en **Settings → Bindings → Add → D1 database**: nombre de variable `DB`, base `juego-del-ano`. Vuelve a desplegar (Deployments → ⋯ → Retry deployment). La web quedará en `https://juego-del-ano.pages.dev` (o el nombre que te asigne).

### 3. Poner el login delante

**Zero Trust → Access → Applications → Add an application → Self-hosted**.
- Application domain: `juego-del-ano.pages.dev` (y, si quieres proteger también las vistas previas, `*.juego-del-ano.pages.dev`).
- Identity provider: **One-time PIN** (viene activado; envía un código al correo).
- Política (Action *Allow*), elige una:
  - **Solo invitados:** Include → *Emails* → lista de correos (el tuyo y los de quien quieras).
  - **Abierta:** Include → *Everyone*. Cualquiera con un correo puede crearse su colección.

Al guardar, abre la aplicación y copia el **Application Audience (AUD) Tag**. En Zero Trust → Settings → Custom pages verás tu **team domain** (algo como `tunombre.cloudflareaccess.com`).

### 4. Decirle a la API quién es quién

En el proyecto de Pages: **Settings → Variables and secrets → Production**:

| Variable | Valor |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `tunombre.cloudflareaccess.com` |
| `ACCESS_AUD` | el AUD Tag del paso 3 |

Vuelve a desplegar. La API comprueba la firma del token de Access en cada petición; sin esas dos variables no deja entrar a nadie.

### 5. Invitar a gente

Con la política de *Solo invitados*, añade su correo a la lista. Cuando entren por primera vez se crea su colección vacía; desde la pestaña **Mi colección** pueden cambiar su nombre visible y decidir si los demás pueden verla.

## Actualizar 2026

Los candidatos de 2026 viven en `public/data/y2026.json`. Para regenerarlos (requiere leer Backloggd desde un navegador, ver `tools/README.md`):

```
cd tools
python3 build2026.py      # escribe tools/docs/*.json
python3 pack2026.py       # los empaqueta en public/data/y2026.json
git commit -am "2026: actualización semanal" && git push
```

Cloudflare Pages redespliega solo al recibir el push.

## Probar en local

```
npx wrangler d1 execute juego-del-ano --local --file=db/schema.sql
npx wrangler d1 execute juego-del-ano --local --file=db/seed.sql
echo 'DEV_EMAIL="belchistim@gmail.com"' > .dev.vars
npx wrangler pages dev public
```

`DEV_EMAIL` solo se usa si no están definidas las variables de Access; nunca la pongas en producción.

## Fuentes

Palmarés: Wikipedia en inglés. Crítica: Metacritic. Jugadores y carátulas: Backloggd e IGDB. Edición física: Wikidata y Wikipedia, con corrección manual compartida desde la web.
