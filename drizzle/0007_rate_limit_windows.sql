CREATE TABLE `rate_limit_windows` (
  `action` text NOT NULL,
  `context_key` text NOT NULL,
  `window_start` integer NOT NULL,
  `count` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`action`, `context_key`, `window_start`),
  CONSTRAINT `rate_limit_windows_action_check` CHECK(`action` in ('refresh', 'download', 'share')),
  CONSTRAINT `rate_limit_windows_count_check` CHECK(`count` >= 0)
);
--> statement-breakpoint
CREATE INDEX `rate_limit_windows_cleanup_idx` ON `rate_limit_windows` (`window_start`);
