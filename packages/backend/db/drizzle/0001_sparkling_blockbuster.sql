CREATE TABLE `started_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`module_id` text NOT NULL,
	`started_at` text NOT NULL,
	`last_accessed_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_module` ON `started_modules` (`student_id`,`module_id`);