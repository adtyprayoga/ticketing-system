CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'expired', 'failed', 'payment_review');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"participant_name" text NOT NULL,
	"amount" integer NOT NULL,
	"attempt_key" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_deadline" timestamp with time zone NOT NULL,
	"hold_released_at" timestamp with time zone,
	"payment_token" text,
	"payment_redirect_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_buyer_attempt_unique" UNIQUE("buyer_id","attempt_key")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE restrict ON UPDATE no action;