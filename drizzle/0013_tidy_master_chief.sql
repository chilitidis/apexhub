CREATE TABLE `coach_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`verdict` varchar(16) NOT NULL DEFAULT 'unsuitable',
	`pair` varchar(24) NOT NULL DEFAULT '',
	`timeframe` varchar(12) NOT NULL DEFAULT '',
	`direction` varchar(8) NOT NULL DEFAULT 'unknown',
	`comment` text NOT NULL,
	`suggestion` text NOT NULL,
	`criteriaJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_analyses_id` PRIMARY KEY(`id`)
);
