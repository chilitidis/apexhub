CREATE TABLE `mt5_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(128) NOT NULL DEFAULT '',
	`platform` enum('mt4','mt5') NOT NULL DEFAULT 'mt5',
	`server` varchar(128) NOT NULL,
	`login` varchar(64) NOT NULL,
	`passwordCipher` text NOT NULL,
	`metaapiAccountId` varchar(128) NOT NULL DEFAULT '',
	`state` varchar(32) NOT NULL DEFAULT 'pending',
	`lastError` text,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mt5_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_login_server` UNIQUE(`userId`,`server`,`login`)
);
