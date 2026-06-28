CREATE TABLE `prop_firm_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`firmName` varchar(64) NOT NULL,
	`programName` varchar(96) NOT NULL,
	`sizeUsd` int NOT NULL,
	`phase` enum('eval','funded') NOT NULL DEFAULT 'eval',
	`label` varchar(120) NOT NULL DEFAULT '',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prop_firm_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prop_firm_state` (
	`userId` int NOT NULL,
	`currency` enum('USD','EUR') NOT NULL DEFAULT 'USD',
	`checks` text NOT NULL DEFAULT (''),
	`notes` text NOT NULL DEFAULT (''),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prop_firm_state_userId` PRIMARY KEY(`userId`)
);
