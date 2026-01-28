CREATE TABLE `reading_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`read_percentage` real DEFAULT 0 NOT NULL,
	`total_read_duration` integer DEFAULT 0 NOT NULL,
	`current_page` integer DEFAULT 1 NOT NULL,
	`last_read_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
