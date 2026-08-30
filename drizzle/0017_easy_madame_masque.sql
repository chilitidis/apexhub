CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramMsgId` varchar(64),
	`postedAt` timestamp NOT NULL DEFAULT (now()),
	`symbol` varchar(20) NOT NULL,
	`direction` enum('BUY','SELL') NOT NULL,
	`entryType` enum('market','limit') NOT NULL DEFAULT 'market',
	`entry` decimal(18,6),
	`sl` decimal(18,6) NOT NULL,
	`tp1` decimal(18,6),
	`tp2` decimal(18,6),
	`tp3` decimal(18,6),
	`status` enum('active','closed','cancelled') NOT NULL DEFAULT 'active',
	`rawText` text,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`),
	CONSTRAINT `signals_telegramMsgId_unique` UNIQUE(`telegramMsgId`)
);
