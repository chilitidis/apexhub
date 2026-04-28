CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`startingBalance` double NOT NULL DEFAULT 0,
	`accountType` enum('prop','live','demo','other') NOT NULL DEFAULT 'other',
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`color` varchar(16) NOT NULL DEFAULT '#0077B6',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `active_trades` DROP INDEX `active_trades_userId_unique`;--> statement-breakpoint
ALTER TABLE `monthly_snapshots` DROP INDEX `uniq_user_month`;--> statement-breakpoint
ALTER TABLE `trades` DROP INDEX `uniq_user_month_idx`;--> statement-breakpoint
ALTER TABLE `active_trades` ADD `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `accountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `active_trades` ADD CONSTRAINT `uniq_user_account_active_trade` UNIQUE(`userId`,`accountId`);--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD CONSTRAINT `uniq_user_account_month` UNIQUE(`userId`,`accountId`,`monthKey`);--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `uniq_user_account_month_idx` UNIQUE(`userId`,`accountId`,`monthKey`,`idx`);