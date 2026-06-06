CREATE TABLE `coach_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`inputType` varchar(16) NOT NULL DEFAULT 'screenshot',
	`imageUrl` text,
	`tvLink` text,
	`pair` varchar(32) NOT NULL DEFAULT '',
	`timeframe` varchar(16) NOT NULL DEFAULT '',
	`direction` varchar(8) NOT NULL DEFAULT '',
	`verdict` varchar(16) NOT NULL DEFAULT 'Marginal',
	`score` int NOT NULL DEFAULT 0,
	`criteriaJson` text NOT NULL,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_analyses_id` PRIMARY KEY(`id`)
);
