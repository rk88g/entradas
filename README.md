# Entradas

Sistema responsivo para control de ingresos y pases de visita con:

- Login como pantalla inicial
- Roles: `super-admin`, `control`, `supervisor`, `capturador`
- Módulos: `Interno`, `Visitas`, `Listado`, `Fechas`
- Apartados de impresión: `618` y `INTIMA`
- Preparado para `Vercel + Supabase`

## Stack propuesto

- Next.js App Router
- TypeScript
- CSS responsivo personalizado
- Supabase Auth + PostgreSQL

## Estructura principal

- `app/`: rutas y pantallas
- `components/`: layout, login y listado imprimible
- `lib/`: tipos, utilidades y datos mock
- `supabase/schema.sql`: esquema inicial de base de datos

## Tablas contempladas

- `roles`
- `user_profiles`
- `internos`
- `visitas`
- `betadas`
- `fechas`
- `listado`
- `listado_visitas`
- `historial_ingresos` como vista

## Reglas de negocio ya consideradas

- El inicio del sistema es el login.
- El listado abre orientado a los pases del día siguiente.
- Los visitantes se muestran de mayor edad a menor.
- Los menores de 12 años se resaltan en rojo en el pase.
- Una visita betada puede bloquearse desde captura.
- Los pases `INTIMA` aceptan menciones para pases sueltos.
- El historial permite revisar qué visitas tuvo un interno y en qué fechas.

## Variables de entorno

Usa `.env.local` basado en `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Flujo de conexión con Supabase

1. Crea el proyecto en Supabase.
2. Ejecuta el contenido de [supabase/schema.sql](/C:/Users/rk88g/Documents/GitHub/entradas/supabase/schema.sql:1) en SQL Editor.
3. Crea usuarios en `Auth`.
4. Inserta el rol correspondiente en `user_profiles`.
5. Copia URL y anon key a `.env.local`.

## Flujo de conexión con Vercel

1. Importa el repositorio en Vercel.
2. Agrega las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Despliega.

## Siguiente implementación recomendada

1. Sustituir los datos mock por lecturas reales a Supabase.
2. Activar login real con Supabase Auth.
3. Crear formularios persistentes con server actions o route handlers.
4. Añadir exportación PDF para pases si la operación lo requiere.

