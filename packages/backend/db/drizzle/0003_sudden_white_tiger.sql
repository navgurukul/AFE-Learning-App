CREATE TABLE `learning_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`summary_text` text NOT NULL,
	`progress_note` text,
	`last_updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
