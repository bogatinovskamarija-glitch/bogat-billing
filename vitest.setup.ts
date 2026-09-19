// src/lib/supabase.ts calls createClient() at module load time, which
// throws immediately if these are unset — so any test that transitively
// imports it (even just for an unrelated pure function in the same file)
// needs dummy-but-well-formed values in place before that import happens.
// Nothing here ever makes a real network call.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test-service-key";
