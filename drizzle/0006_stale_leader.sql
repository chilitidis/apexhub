CREATE TABLE `shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL,
	`monthKey` varchar(16) NOT NULL DEFAULT '',
	`payloadJson` text NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `shares_token_unique` UNIQUE(`token`)
);
