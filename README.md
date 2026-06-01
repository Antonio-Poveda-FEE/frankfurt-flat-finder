# 🏙️ Frankfurt Flat Finder

App web (PWA) para **puntuar, comparar y decidir** entre pisos durante la búsqueda en
Frankfurt. Pensada para usar a la vez desde el móvil y el ordenador, con datos
sincronizados entre dos personas.

## Qué hace

- **Pisos**: alta/edición con fotos (cámara o galería), dirección, tamaño, habitaciones, estado y enlace a ImmoScout24.
- **Costes**: desglose (alquiler base, Nebenkosten, calefacción, internet, luz, agua, garaje, fianza…) con **total mensual** y **€/m²** automáticos.
- **Tiempos de ida**: por cada punto de interés (trabajo, gimnasio, centro…) botones a Google Maps en 4 modos — 🚶 andando, 🚲 bici, 🚇 metro/bus, 🚗 coche — y opción de guardar los minutos a mano. Botones extra de bares/parques/supermercados cerca.
- **Puntuación**: 16 criterios con peso ajustable (luz, ruido, estado, cocina, baño, distribución, barrio, transporte, ocio, parques, calidad-precio…). Cada persona puntúa por separado y se combinan.
- **Recomendación estadística**: combina cuatro métodos para aconsejarte:
  1. **Puntuación ponderada** (0–100) por piso.
  2. **Problema de la secretaria / regla del 37%**: fase de exploración vs. decisión según cuántos pisos planeáis ver.
  3. **z-score**: si un piso destaca de forma significativa frente al resto.
  4. **Estadística de orden**: estima el mejor piso esperado entre los que aún no habéis visto, para decidir si merece la pena seguir buscando o ya quedaros uno.

## Stack

- React + TypeScript + Vite + Tailwind CSS (build estático).
- Supabase (Postgres + Auth + Storage) para datos, login y fotos.
- recharts para el gráfico radar.
- PWA instalable; se sirve gratis en **GitHub Pages**.

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

La conexión a Supabase va embebida en `src/lib/config.ts` (la *publishable key* es
pública por diseño y está protegida por RLS + autenticación). Para apuntar a otro
proyecto, crea un `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`.

## Despliegue

Cada `push` a `main` dispara el workflow de **GitHub Actions** (`.github/workflows/deploy.yml`)
que construye y publica en GitHub Pages. Activa Pages en *Settings → Pages → Source: GitHub Actions*.

La app usa `base: './'` + `HashRouter`, así que funciona en cualquier subruta de Pages
sin reconfigurar.

## Cuentas

El acceso es por email + contraseña (Supabase Auth). Las cuentas de los dos usuarios
se crean en el proyecto Supabase. Todos los usuarios autenticados comparten el mismo
espacio de datos (es intencionado: es vuestro tablero común de pisos).

## Notas de seguridad

- Las políticas RLS permiten a *cualquier usuario autenticado* leer/escribir todo: es
  un espacio compartido para dos personas, no multi-tenant.
- El bucket de fotos es público para que las imágenes se muestren por URL directa.
- Opcional: en Supabase puedes activar *Leaked Password Protection* (Auth → Policies).
