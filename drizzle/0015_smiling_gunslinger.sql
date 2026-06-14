CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256) NOT NULL DEFAULT '',
	`userEmail` varchar(320) NOT NULL DEFAULT '',
	`category` varchar(24) NOT NULL DEFAULT 'feature',
	`message` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
