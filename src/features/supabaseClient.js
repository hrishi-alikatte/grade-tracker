// Client Supabase — importé DYNAMIQUEMENT et uniquement si les variables
// d'environnement sont présentes. Sans clés (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY), `isSupabaseConfigured` vaut false et toute la couche
// cloud devient inerte : l'app fonctionne exactement comme avant, 100% locale,
// sans le moindre appel réseau ni octet de supabase-js chargé.
//
// Ne jamais placer ici la clé service_role — seule la clé anon (publique) est
// admise côté client ; la RLS protège les données.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

// Renvoie le client (Promise), ou null si non configuré. Le bundle supabase-js
// n'est téléchargé qu'au premier appel réel.
export function getSupabase() {
    if (!isSupabaseConfigured) return Promise.resolve(null);
    if (!clientPromise) {
        clientPromise = import('@supabase/supabase-js')
            .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                },
            }))
            .catch((err) => {
                console.error('Échec du chargement de Supabase', err);
                clientPromise = null;
                return null;
            });
    }
    return clientPromise;
}
