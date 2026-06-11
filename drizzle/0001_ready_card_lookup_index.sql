CREATE INDEX IF NOT EXISTS `cards_ready_lookup_idx` ON `cards` (`status`, `created_at`, `id`);
