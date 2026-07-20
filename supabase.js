// Conexión única de OroMar con Supabase.
// Reemplaza únicamente los dos valores siguientes con los datos de tu proyecto.

(() => {
  const SUPABASE_URL = 'https://gdzeerypvkjlwlezopyv.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_foo1wbVhpWS0tervZYYYNA_5Yc9X3B5';

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
