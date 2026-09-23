CREATE TABLE `afe_feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`serial_number` text,
	`school_udise` text,
	`school_name` text,
	`message` text,
	`feedback_type` text DEFAULT 'USER_FEEDBACK' NOT NULL,
	`screenshot_path` text,
	`log_file_path` text,
	`synced` integer DEFAULT false NOT NULL,
	`is_dev_mode` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`synced_at` text
);
