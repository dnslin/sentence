CREATE TABLE `sentences` (
  `id` text PRIMARY KEY NOT NULL,
  `text` text NOT NULL,
  `source` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards` (
  `id` text PRIMARY KEY NOT NULL,
  `sentence_id` text NOT NULL,
  `status` text NOT NULL,
  `scene_label` text NOT NULL,
  `accent` text NOT NULL,
  `illustration_path` text,
  `style_version` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON UPDATE no action ON DELETE no action
);
