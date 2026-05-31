const SUPABASE_URL = "https://zheplnscvozscbcoludo.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_PWstV_NtMeF7YCMt35FrlA_6410u0g2";

const forjaDB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Importante: scripts como nav.js precisam acessar o cliente pelo window.
// `const forjaDB` funciona para scripts globais, mas não cria `window.forjaDB` automaticamente.
window.forjaDB = forjaDB;
