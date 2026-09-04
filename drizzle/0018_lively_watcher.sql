CREATE TABLE `investor_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL,
	`token` varchar(32) NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `investor_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `investor_links_token_unique` UNIQUE(`token`)
);
