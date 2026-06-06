CREATE TABLE `coach_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(16) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coach_analyses` MODIFY COLUMN `timeframe` varchar(24) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `coach_analyses` ADD `observations` text DEFAULT ('') NOT NULL;--> statement-breakpoint
ALTER TABLE `coach_analyses` ADD `rr` varchar(24) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coach_analyses` ADD `timeAnalysis` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coach_analyses` ADD `elliottNote` varchar(320) DEFAULT '' NOT NULL;