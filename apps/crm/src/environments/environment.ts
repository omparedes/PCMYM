// Entorno de PRODUCCIÓN (default del build). En desarrollo se reemplaza por
// environment.development.ts vía fileReplacements (angular.json).
// Solo claves PÚBLICAS de Supabase (anon). La seguridad real la impone RLS.
// Valores reales: variables NG_APP_* en Vercel / tu .env (ver .env.example).
export const environment = {
  production: true,
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
