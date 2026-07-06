CREATE TABLE "approval_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"approver_id" uuid,
	"action" varchar(40) NOT NULL,
	"opinion" text NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"from_status" varchar(40) NOT NULL,
	"to_status" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"min_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_amount" numeric(12, 2),
	"target_level" integer DEFAULT 1 NOT NULL,
	"timeout_hours" integer DEFAULT 24 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"action" varchar(80) NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"request_id" varchar(80),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compensation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"approval_record_id" uuid,
	"direction" varchar(40) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(40) DEFAULT 'recorded' NOT NULL,
	"reconciliation_ref" varchar(120),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exception_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_no" varchar(40) NOT NULL,
	"external_code" varchar(255) NOT NULL,
	"snapshot_id" uuid,
	"source" varchar(40) NOT NULL,
	"category" varchar(40) NOT NULL,
	"exception_type" varchar(80) NOT NULL,
	"severity" varchar(40) DEFAULT 'medium' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text NOT NULL,
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL,
	"reporter_id" uuid,
	"assigned_approver_id" uuid,
	"resubmit_count" integer DEFAULT 0 NOT NULL,
	"max_resubmit_count" integer DEFAULT 2 NOT NULL,
	"timeout_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(80) NOT NULL,
	"system" varchar(40) DEFAULT 'v2' NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(12) NOT NULL,
	"params_digest" text,
	"status_code" integer,
	"success" boolean DEFAULT false NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_code" varchar(255) NOT NULL,
	"sku_name" varchar(255) NOT NULL,
	"batch_no" varchar(120) NOT NULL,
	"available_qty" integer DEFAULT 0 NOT NULL,
	"locked_qty" integer DEFAULT 0 NOT NULL,
	"status" varchar(40) DEFAULT 'available' NOT NULL,
	"warehouse_id" varchar(80) DEFAULT 'default-warehouse' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"approval_record_id" uuid,
	"sku_code" varchar(255) NOT NULL,
	"batch_no" varchar(120) NOT NULL,
	"movement_type" varchar(60) NOT NULL,
	"quantity" integer NOT NULL,
	"before_qty" integer NOT NULL,
	"after_qty" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qc_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"sub_type" varchar(80) NOT NULL,
	"condition_type" varchar(80) NOT NULL,
	"condition_config" jsonb NOT NULL,
	"severity" varchar(40) DEFAULT 'medium' NOT NULL,
	"auto_create_ticket" boolean DEFAULT true NOT NULL,
	"target_approval_level" integer DEFAULT 2 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scan_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_no" varchar(40) NOT NULL,
	"external_code" varchar(255) NOT NULL,
	"sku_code" varchar(255) NOT NULL,
	"batch_no" varchar(120) NOT NULL,
	"operator_id" uuid,
	"device_id" varchar(80),
	"qc_result" varchar(40) NOT NULL,
	"qc_status" varchar(40) NOT NULL,
	"matched_rule_id" uuid,
	"rule_snapshot" jsonb,
	"evidence" jsonb,
	"description" text,
	"ticket_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(40) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"warehouse_id" varchar(80) DEFAULT 'default-warehouse' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "waybill_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_code" varchar(255) NOT NULL,
	"v2_order_id" uuid,
	"store_name" varchar(255),
	"receiver_name" varchar(100),
	"receiver_phone" varchar(50),
	"receiver_address" text,
	"amount" numeric(12, 2),
	"items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(40) DEFAULT 'v2_realtime' NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_ticket_id_exception_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."exception_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_ticket_id_exception_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."exception_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_approval_record_id_approval_records_id_fk" FOREIGN KEY ("approval_record_id") REFERENCES "public"."approval_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_tickets" ADD CONSTRAINT "exception_tickets_snapshot_id_waybill_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."waybill_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_tickets" ADD CONSTRAINT "exception_tickets_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_tickets" ADD CONSTRAINT "exception_tickets_assigned_approver_id_users_id_fk" FOREIGN KEY ("assigned_approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_ticket_id_exception_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."exception_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_approval_record_id_approval_records_id_fk" FOREIGN KEY ("approval_record_id") REFERENCES "public"."approval_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_ticket_id_exception_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."exception_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_approval_records_idempotency" ON "approval_records" USING btree ("ticket_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_approval_records_ticket_id" ON "approval_records" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_exception_tickets_ticket_no" ON "exception_tickets" USING btree ("ticket_no");--> statement-breakpoint
CREATE INDEX "idx_exception_tickets_external_code" ON "exception_tickets" USING btree ("external_code");--> statement-breakpoint
CREATE INDEX "idx_exception_tickets_status" ON "exception_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_exception_tickets_timeout_at" ON "exception_tickets" USING btree ("timeout_at");--> statement-breakpoint
CREATE INDEX "idx_integration_logs_request_id" ON "integration_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_integration_logs_created_at" ON "integration_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_sku_batch_warehouse" ON "inventory_items" USING btree ("sku_code","batch_no","warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_status" ON "inventory_items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_scan_records_scan_no" ON "scan_records" USING btree ("scan_no");--> statement-breakpoint
CREATE INDEX "idx_scan_records_batch" ON "scan_records" USING btree ("sku_code","batch_no");--> statement-breakpoint
CREATE INDEX "idx_scan_records_ticket_id" ON "scan_records" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_waybill_snapshots_external_code" ON "waybill_snapshots" USING btree ("external_code");--> statement-breakpoint
CREATE INDEX "idx_waybill_snapshots_synced_at" ON "waybill_snapshots" USING btree ("synced_at");