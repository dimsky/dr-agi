import { pgTable, unique, uuid, varchar, text, timestamp, boolean, foreignKey, json, numeric, integer, pgEnum } from "drizzle-orm/pg-core"

export const feedbackCategory = pgEnum("feedback_category", ['bug_report', 'feature_request', 'improvement', 'user_experience', 'performance', 'content_quality', 'service_quality', 'other'])
export const feedbackStatus = pgEnum("feedback_status", ['pending', 'reviewing', 'responded', 'resolved', 'closed'])
export const orderStatus = pgEnum("order_status", ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded'])
export const paymentMethod = pgEnum("payment_method", ['wechat_pay', 'alipay', 'credit_card', 'bank_card'])
export const taskStatus = pgEnum("task_status", ['pending', 'running', 'completed', 'failed', 'cancelled'])


export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	openId: varchar("open_id", { length: 128 }).notNull(),
	unionId: varchar("union_id", { length: 128 }),
	nickname: varchar({ length: 100 }),
	avatarUrl: text("avatar_url"),
	gender: varchar({ length: 10 }),
	city: varchar({ length: 50 }),
	province: varchar({ length: 50 }),
	country: varchar({ length: 50 }),
	language: varchar({ length: 20 }),
	email: varchar({ length: 255 }),
	profession: varchar({ length: 100 }),
	phone: varchar({ length: 20 }),
	registeredAt: timestamp("registered_at", { mode: 'string' }).defaultNow().notNull(),
	consentAgreedAt: timestamp("consent_agreed_at", { mode: 'string' }),
	consentVersion: varchar("consent_version", { length: 20 }),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_open_id_unique").on(table.openId),
]);

export const feedback = pgTable("feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	feedbackNumber: varchar("feedback_number", { length: 20 }).notNull(),
	category: feedbackCategory().notNull(),
	title: varchar({ length: 200 }).notNull(),
	content: text().notNull(),
	status: feedbackStatus().default('pending').notNull(),
	adminResponse: text("admin_response"),
	adminId: uuid("admin_id"),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "feedback_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("feedback_feedback_number_unique").on(table.feedbackNumber),
]);

export const orders = pgTable("orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	serviceConfigId: uuid("service_config_id").notNull(),
	serviceData: json("service_data"),
	status: orderStatus().default('pending').notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	paymentMethod: paymentMethod("payment_method"),
	transactionId: varchar("transaction_id", { length: 128 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.serviceConfigId],
			foreignColumns: [aiService.id],
			name: "orders_service_config_id_ai_service_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const aiService = pgTable("ai_service", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	serviceType: varchar("service_type", { length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	description: text(),
	difyApiKey: varchar("dify_api_key", { length: 256 }),
	difyBaseUrl: varchar("dify_base_url", { length: 512 }),
	pricing: json(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("ai_service_service_type_unique").on(table.serviceType),
]);

export const tasks = pgTable("tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	serviceConfigId: uuid("service_config_id").notNull(),
	difyTaskId: varchar("dify_task_id", { length: 128 }),
	difyExecutionId: varchar("dify_execution_id", { length: 128 }),
	status: taskStatus().default('pending').notNull(),
	inputData: json("input_data"),
	outputData: json("output_data"),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0).notNull(),
	executionTime: integer("execution_time"),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "tasks_order_id_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.serviceConfigId],
			foreignColumns: [aiService.id],
			name: "tasks_service_config_id_ai_service_id_fk"
		}).onDelete("restrict"),
]);
