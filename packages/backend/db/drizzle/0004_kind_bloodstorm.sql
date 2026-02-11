CREATE TABLE `daily_sync_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`modules_started` integer DEFAULT 0 NOT NULL,
	`modules_completed` integer DEFAULT 0 NOT NULL,
	`time_watched` integer DEFAULT 0 NOT NULL,
	`time_read` integer DEFAULT 0 NOT NULL,
	`avg_quiz_score` real DEFAULT 0 NOT NULL,
	`learning_summary_text` text,
	`learning_summary_progress_note` text,
	`learning_summary_updated_at` text,
	`synced` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_student_date` ON `daily_sync_snapshots` (`student_id`,`snapshot_date`);