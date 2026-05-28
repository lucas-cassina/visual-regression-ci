# visual-regression-ci

Atrapá las regresiones visuales que tus tests no ven.

Los tests unitarios y de integración verifican comportamiento, no píxeles. Un botón que se va de pantalla
en mobile, un texto que pierde contraste, un layout que se rompe en un ancho angosto — todas estas cosas
pasan CI y llegan a producción. Esta herramienta corre en cada PR que toca UI: saca screenshots de las
pantallas afectadas, las compara contra `main`, le pregunta a un modelo de visión si cada diferencia es un
**bug real** o un **cambio esperado**, y comenta en el PR con los diffs visuales.

## Cómo funciona

```
PR abierto (toca UI)
        │
        ▼
  captura current ──┐
                    ├──▶  pixel diff  ──▶  solo screens cambiados  ──▶  GPT-4o clasifica
  captura baseline ─┘     (pixelmatch)                                  (bug | esperado)
   (build de main)                                                            │
                                                                              ▼
                                          comentario sticky en el PR con baseline / current / diff
```

El pipeline es **híbrido a propósito**: un pixel diff barato decide *qué* cambió, y el modelo de visión
solo mira las pantallas que efectivamente cambiaron — el costo de la IA queda proporcional al tamaño del
cambio, no al tamaño de la app.

La baseline se construye desde `main` en el mismo job de CI, así que no hay storage de snapshots para
mantener ni baselines viejas: cada corrida compara contra un build fresco de la branch destino.

## Stack

- **Playwright** (Chromium) para screenshots full-page determinísticos en viewports desktop y mobile.
- **pixelmatch** + **pngjs** para el diff píxel a píxel y los overlays con regiones resaltadas.
- **OpenAI GPT-4o** (intercambiable) para clasificar cada pantalla cambiada como bug o cambio esperado.
- **GitHub Actions** para orquestar, con comentarios sticky en el PR vía la API REST de GitHub.

## Inicio rápido (local)

```bash
npm install
npx playwright install --with-deps chromium
cp examples/cra.vrt.config.js vrt.config.js   # editá routes, viewports, baseUrl

# capturá dos estados de tu app y compará
npm run vrt -- capture baseline      # contra el build "antes"
npm run vrt -- capture current       # contra el build "después"
OPENAI_API_KEY=sk-... npm run vrt -- analyze   # diff + classify + report
open out/report.md
```

`analyze` corre `diff` → `classify` → `report`. Para ver todos los comandos: `npm run vrt -- help`.
Cuando lo instalás como dependencia en tu propia app (`npm i -D visual-regression-ci`), los mismos
comandos están disponibles como `npx vrt <comando>`.

### Probá la demo incluida

El repo trae un fixture con dos estados — un "antes" y un "después" — que cubre cuatro categorías de
regresión que vas a ver reflejadas en el reporte:

- **Layout** (`home`): un botón pasa a `position: absolute` y queda superpuesto al título.
- **Contraste** (`pricing`): el precio queda en gris claro sobre fondo blanco — ilegible.
- **Mobile-only** (`signup`): una regla `@media (max-width: 600px)` esconde el CTA en viewports angostos. Desktop queda intacto, mobile se rompe sin que nadie lo note en review.
- **Contenido cortado** (`news`): el copy nuevo es más largo, pero la card sigue con altura fija y `overflow: hidden`, así que el call-to-action desaparece.

Una quinta pantalla (`about`) es idéntica entre los dos estados — el control, para mostrar que la
herramienta no marca pantallas que en realidad no cambiaron.

```bash
npm run demo
open out/report.md   # con OPENAI_API_KEY también obtenés los veredictos bug/expected
```

## Configuración

`vrt.config.js` (ver [`vrt.config.example.js`](./vrt.config.example.js)):

| Clave | Qué controla |
| --- | --- |
| `baseUrl` | Dónde está sirviéndose la app durante la captura |
| `routes` | Pantallas a capturar (`{ name, path, waitFor?, mask? }`) |
| `viewports` | Tamaños a los que capturar cada ruta — incluí uno mobile |
| `mask` | Selectores CSS enmascarados en toda ruta (fechas, carouseles, ads…) para evitar falsos positivos |
| `threshold` | Sensibilidad por píxel de pixelmatch (0–1) |
| `diffRatioThreshold` | Fracción de píxeles cambiados a partir de la cual una pantalla se marca |
| `classify` | `{ enabled, provider, model }` para el paso de visión |

El determinismo importa: se desactivan animaciones y transitions, se esperan las web fonts, se oculta el
caret, y las regiones enmascaradas se pintan encima antes de cada screenshot. Enmascará cualquier cosa
no determinística o vas a terminar con diffs ruidosos.

## Setup en CI (GitHub Actions)

Copiá [`.github/workflows/visual-regression.yml`](./.github/workflows/visual-regression.yml) al repo de
tu app y adaptá las tres líneas marcadas como `APP-SPECIFIC` (install / build / serve). Después:

1. Agregá un secret `OPENAI_API_KEY` en el repo.
2. Abrí un PR que toque UI — el workflow captura las dos branches, hace diff, clasifica y comenta.

Las imágenes de diff se pushean a una branch `vrt-results` y el comentario las referencia vía
`raw.githubusercontent.com`, así que renderizan inline sin hosting externo.

> ¿Usás GitLab en lugar de GitHub? Mirá [`examples/gitlab-ci.yml`](./examples/gitlab-ci.yml) — los
> scripts core son CI-agnostic.

## Resultados

<!-- Reemplazar con capturas reales antes/después de una corrida en tu app. -->
_Agregar acá screenshots del comentario en el PR — por ejemplo, una regresión de layout y una de
contraste cazadas en mobile._

## Licencia

MIT
