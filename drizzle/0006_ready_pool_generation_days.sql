CREATE TABLE `ready_pool_generation_days` (
  `day_key` text PRIMARY KEY NOT NULL,
  `generation_count` integer NOT NULL CHECK (`generation_count` >= 0),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
