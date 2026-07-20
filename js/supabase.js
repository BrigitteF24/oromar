// ============================================================
//   OroMar – conexión única con Supabase
// ============================================================

(() => {
  const SUPABASE_URL = 'https://TU_PROJECT_REF.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'TU_CLAVE_PUBLICABLE';

  if (!window.supabase?.createClient) {
    throw new Error('La librería de Supabase no fue cargada antes de supabase.js');
  }

  if (
    SUPABASE_URL.includes('TU_PROJECT_REF') ||
    SUPABASE_PUBLISHABLE_KEY.includes('TU_CLAVE_PUBLICABLE')
  ) {
    throw new Error('Debes colocar tu URL y tu clave publicable dentro de supabase.js');
  }

  if (!window.oromarDb) {
    window.oromarDb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
  }
})();
