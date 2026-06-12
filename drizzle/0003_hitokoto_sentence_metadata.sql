CREATE TABLE `hitokoto_sentence_metadata` (
  `sentence_id` text PRIMARY KEY NOT NULL,
  `hitokoto_uuid` text,
  `source_identity` text NOT NULL,
  `hitokoto_id` integer,
  `type` text,
  `from_text` text,
  `from_who` text,
  `creator` text,
  `creator_uid` integer,
  `reviewer` integer,
  `commit_from` text,
  `hitokoto_created_at` text,
  `length` integer,
  `fetched_at` integer NOT NULL,
  FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hitokoto_sentence_metadata_uuid_idx` ON `hitokoto_sentence_metadata` (`hitokoto_uuid`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hitokoto_sentence_metadata_identity_idx` ON `hitokoto_sentence_metadata` (`source_identity`);
