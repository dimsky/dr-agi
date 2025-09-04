import { relations } from "drizzle-orm/relations";
import { users, feedback, aiService, orders, tasks } from "./schema";

export const feedbackRelations = relations(feedback, ({one}) => ({
	user: one(users, {
		fields: [feedback.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	feedbacks: many(feedback),
	orders: many(orders),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	aiService: one(aiService, {
		fields: [orders.serviceConfigId],
		references: [aiService.id]
	}),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	tasks: many(tasks),
}));

export const aiServiceRelations = relations(aiService, ({many}) => ({
	orders: many(orders),
	tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({one}) => ({
	order: one(orders, {
		fields: [tasks.orderId],
		references: [orders.id]
	}),
	aiService: one(aiService, {
		fields: [tasks.serviceConfigId],
		references: [aiService.id]
	}),
}));