ALTER TABLE "orders" RENAME COLUMN "service_config_id" TO "ai_service_id";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "service_config_id" TO "ai_service_id";--> statement-breakpoint
ALTER TABLE "ai_service" DROP CONSTRAINT "ai_service_service_type_unique";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_service_config_id_ai_service_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_service_config_id_ai_service_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ai_service_id_ai_service_id_fk" FOREIGN KEY ("ai_service_id") REFERENCES "public"."ai_service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ai_service_id_ai_service_id_fk" FOREIGN KEY ("ai_service_id") REFERENCES "public"."ai_service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_service" DROP COLUMN "service_type";