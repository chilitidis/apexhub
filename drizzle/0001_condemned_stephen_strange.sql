CREATE TABLE `active_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`direction` enum('BUY','SELL') NOT NULL,
	`lots` double NOT NULL DEFAULT 0,
	`entry` double NOT NULL DEFAULT 0,
	`currentPrice` double NOT NULL DEFAULT 0,
	`openTime` varchar(64) NOT NULL DEFAULT '',
	`floatingPnl` double NOT NULL DEFAULT 0,
	`balance` double NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `active_trades_id` PRIMARY KEY(`id`),
	CONSTRAINT `active_trades_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `monthly_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`monthKey` varchar(16) NOT NULL,
	`monthName` varchar(32) NOT NULL,
	`yearFull` varchar(8) NOT NULL,
	`yearShort` varchar(4) NOT NULL,
	`starting` double NOT NULL DEFAULT 0,
	`ending` double NOT NULL DEFAULT 0,
	`netResult` double NOT NULL DEFAULT 0,
	`returnPct` double NOT NULL DEFAULT 0,
	`totalTrades` int NOT NULL DEFAULT 0,
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`winRate` double NOT NULL DEFAULT 0,
	`maxDrawdownPct` double NOT NULL DEFAULT 0,
	`tradesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_month` UNIQUE(`userId`,`monthKey`)
);
