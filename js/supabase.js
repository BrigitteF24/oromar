// ============================================================
//   OroMar – conexión única con Supabase
// ============================================================

(() => {
  const SUPABASE_URL = 'link: https://tbyrwjmmiryrosdaeuir.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4NFqw5dQvpPi0VDBjMn5jQ_5xK3fobI';

  if (!window.supabase?.createClient) {
    throw new Error('La librería de Supabase no fue cargada antes de supabase.js');
  }

  if (
    SUPABASE_URL.includes('link: https://tbyrwjmmiryrosdaeuir.supabase.co') ||
    SUPABASE_PUBLISHABLE_KEY.includes('sb_publishable_4NFqw5dQvpPi0VDBjMn5jQ_5xK3fobI')
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
