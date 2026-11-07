const { createClient } = require("@supabase/supabase-js");

/**
 * Supabase Client Configuration (Secondary Backup Database)
 *
 * NOTE: The primary database for production deployment is Cloudflare D1.
 * Supabase PostgreSQL serves as the backup/secondary database.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  console.warn(
    "[Database] Primary database is Cloudflare D1. Supabase configured in standby (backup) mode."
  );

  // Fallback stub to prevent immediate process crash when operating in Cloudflare D1 mode
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    }),
  };
}

module.exports = supabase;