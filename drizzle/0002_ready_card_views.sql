CREATE TABLE `ready_card_views` (
  `id` text PRIMARY KEY NOT NULL,
  `visitor_key` text NOT NULL,
  `card_id` text NOT NULL,
  `seen_at` integer NOT NULL,
  FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ready_card_views_recent_idx` ON `ready_card_views` (`visitor_key`, `seen_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ready_card_views_card_idx` ON `ready_card_views` (`visitor_key`, `card_id`, `seen_at`);
