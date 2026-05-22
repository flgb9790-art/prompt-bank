import { migrateSupabaseMedia } from "../src/services/migrate-supabase-media.service";

migrateSupabaseMedia()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
