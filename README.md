# Entradas

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

