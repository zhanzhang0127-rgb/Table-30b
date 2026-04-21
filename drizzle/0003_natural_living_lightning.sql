ALTER TABLE `restaurants` ADD `status` enum('published','pending','rejected') DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `submittedBy` int;