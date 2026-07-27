// Conexión única de OroMar con Supabase.
// Reemplaza únicamente los dos valores siguientes con los datos de tu proyecto.

(() => {
  const SUPABASE_URL = 'https://wrrsovsihfxqrfpfudod.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pcEBMHfA8DbwDV2uoS3rVg_LgQAhQzh';

  if (!window.supabase?.createClient) {
    console.error('No se cargó la librería oficial de Supabase.');
    return;
  }

  if (!window.oromarDb) {
    window.oromarDb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
  }
})();
