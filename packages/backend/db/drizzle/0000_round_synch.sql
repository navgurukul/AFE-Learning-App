CREATE TABLE `ai_chat_history` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`module_id` text,
	`created_at` text NOT NULL,
	`last_message_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`event_type` text NOT NULL,
	`metadata` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`version` text NOT NULL,
	`hash` text NOT NULL,
	`module_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`video_url` text,
	`reading_url` text,
	`order` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`version` text NOT NULL,
	`hash` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`thumbnail_url` text,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`score` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`answers` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`completed_at` text NOT NULL,
	`time_taken` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`created_at` text NOT NULL,
	`last_active_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`synced` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `video_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`watched_percentage` real DEFAULT 0 NOT NULL,
	`total_watch_duration` integer DEFAULT 0 NOT NULL,
	`last_watched_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_content_id_unique` ON `lessons` (`content_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `modules_content_id_unique` ON `modules` (`content_id`);