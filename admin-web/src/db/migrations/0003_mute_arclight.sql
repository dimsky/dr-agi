ALTER TABLE "ai_service" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_at" timestamp;