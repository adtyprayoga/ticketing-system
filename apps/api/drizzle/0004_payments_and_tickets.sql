CREATE TABLE "payment_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"raw" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator_payments" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"lookup_code" text NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tickets_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "tickets_lookup_code_unique" UNIQUE("lookup_code")
);
--> statement-breakpoint
ALTER TABLE "payment_notifications" ADD CONSTRAINT "payment_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator_payments" ADD CONSTRAINT "simulator_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;