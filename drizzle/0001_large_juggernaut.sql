CREATE TABLE `systemMonitor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(64) NOT NULL,
	`status` enum('unknown','up','down') NOT NULL DEFAULT 'unknown',
	`lastCheckedAt` timestamp,
	`lastAlertAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemMonitor_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemMonitor_service_unique` UNIQUE(`service`)
);
