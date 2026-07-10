/**
 * Application Configuration
 * Handles environment variables with validation and helpful error messages
 */

interface AppConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  /** Base para llamadas a /api/* — vacío en web (mismo origen); URL de Vercel en la app de escritorio */
  apiBase: string;
  isConfigured: boolean;
  missingVars: string[];
}

function getConfig(): AppConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || null;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || null;
  const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

  const missingVars: string[] = [];

  if (!supabaseUrl) {
    missingVars.push('VITE_SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  }

  const isConfigured = missingVars.length === 0;

  return {
    supabaseUrl,
    supabaseAnonKey,
    apiBase,
    isConfigured,
    missingVars,
  };
}

export const config = getConfig();

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return config.isConfigured;
}

/**
 * Get missing environment variables
 */
export function getMissingVars(): string[] {
  return config.missingVars;
}

/**
 * Get configuration error message for display
 */
export function getConfigErrorMessage(): string {
  if (config.isConfigured) {
    return '';
  }

  const missing = config.missingVars.join(' y ');
  const plural = config.missingVars.length > 1 ? 'n' : '';

  return `Falta${plural} configurar ${missing} en las variables de entorno.`;
}

/**
 * Instructions for setting up environment variables
 */
export const SETUP_INSTRUCTIONS = `
Para configurar CEO MODELTEX correctamente:

1. Obtené tus credenciales de Supabase:
   - Andá a https://supabase.com/dashboard
   - Seleccioná tu proyecto
   - Ve a Settings > API
   - Copiá la "URL" y la "anon public key"

2. En Vercel:
   - Andá a tu proyecto en Vercel
   - Settings > Environment Variables
   - Agregá:
     * VITE_SUPABASE_URL = [tu URL de Supabase]
     * VITE_SUPABASE_ANON_KEY = [tu anon key de Supabase]
   - Hacé clic en "Save"

3. Configurá el Asistente Operativo IA en Vercel (lado servidor):
   - Agregá OPENAI_API_KEY = [tu clave privada de OpenAI]
   - Opcional: AI_PROVIDER = openai
   - Opcional: OPENAI_MODEL = gpt-4o-mini
   - No uses claves de IA en código ni las llames directamente desde el navegador.

4. Redesplegá el proyecto:
   - Deployments > Click en los 3 puntos del último deploy
   - "Redeploy"

La aplicación se conectará automáticamente a Supabase y el chat usará /api/ai-chat para proteger la clave de IA.
`.trim();
