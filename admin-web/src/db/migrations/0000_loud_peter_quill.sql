CREATE TYPE "public"."feedback_category" AS ENUM('bug_report', 'feature_request', 'improvement', 'user_experience', 'performance', 'content_quality', 'service_quality', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('pending', 'reviewing', 'responded', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('wechat_pay', 'alipay', 'credit_card', 'bank_card');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "ai_service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"test_var" text,
	"dify_api_key" varchar(256),
	"dify_base_url" varchar(512),
	"pricing" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_service_service_type_unique" UNIQUE("service_type")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feedback_number" varchar(20) NOT NULL,
	"category" "feedback_category" NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"status" "feedback_status" DEFAULT 'pending' NOT NULL,
	"admin_response" text,
	"admin_id" uuid,
	"responded_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_feedback_number_unique" UNIQUE("feedback_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"open_id" varchar(128) NOT NULL,
	"union_id" varchar(128),
	"nickname" varchar(100),
	"avatar_url" text,
	"gender" varchar(10),
	"city" varchar(50),
	"province" varchar(50),
	"country" varchar(50),
	"language" varchar(20),
	"email" varchar(255),
	"profession" varchar(100),
	"phone" varchar(20),
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"consent_agreed_at" timestamp,
	"consent_version" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_config_id" uuid NOT NULL,
	"service_data" json,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method",
	"transaction_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"service_config_id" uuid NOT NULL,
	"dify_task_id" varchar(128),
	"dify_execution_id" varchar(128),
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"input_data" json,
	"output_data" json,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"execution_time" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_config_id_ai_service_id_fk" FOREIGN KEY ("service_config_id") REFERENCES "public"."ai_service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_service_config_id_ai_service_id_fk" FOREIGN KEY ("service_config_id") REFERENCES "public"."ai_service"("id") ON DELETE restrict ON UPDATE no action;