CREATE TABLE `generation_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `sentence_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` in ('started', 'prompt_fallback', 'image_generated', 'failed')),
  `prompt_model` text NOT NULL,
  `image_model` text NOT NULL,
  `prompt_text` text NOT NULL,
  `prompt_source` text NOT NULL CHECK (`prompt_source` in ('rewrite', 'fallback')),
  `image_mime_type` text,
  `image_byte_length` integer,
  `image_sha256` text,
  `error_stage` text CHECK (`error_stage` is null or `error_stage` in ('prompt_rewrite', 'image_generation', 'image_validation', 'smoke_write')),
  `error_message` text,
  `image_generation_attempts` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generation_attempts_sentence_idx` ON `generation_attempts` (`sentence_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `generation_attempts_status_idx` ON `generation_attempts` (`status`, `updated_at`);
