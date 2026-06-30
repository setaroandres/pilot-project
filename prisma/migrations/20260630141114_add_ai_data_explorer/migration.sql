-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_outcomes" (
    "id" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "satisfaction_score" DOUBLE PRECISION NOT NULL,
    "readmission_rate" DOUBLE PRECISION NOT NULL,
    "avg_length_of_stay" DOUBLE PRECISION NOT NULL,
    "triage_protocol" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_metrics" (
    "id" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "staffing_efficiency" DOUBLE PRECISION NOT NULL,
    "bed_occupancy_rate" DOUBLE PRECISION NOT NULL,
    "er_wait_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_records" (
    "id" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "procedure_code" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "reimbursement_rate" DOUBLE PRECISION NOT NULL,
    "claims_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entries" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "column_name" TEXT,
    "business_label" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "caveats" TEXT,
    "lineage" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_query" TEXT NOT NULL,
    "query_spec" JSONB,
    "chart_spec" JSONB,
    "result_metadata" JSONB,
    "narrative_summary" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pinned_visualizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "query_spec" JSONB NOT NULL,
    "chart_spec" JSONB NOT NULL,
    "result_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_visualizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- CreateIndex
CREATE INDEX "patient_outcomes_facility_idx" ON "patient_outcomes"("facility");

-- CreateIndex
CREATE INDEX "patient_outcomes_quarter_idx" ON "patient_outcomes"("quarter");

-- CreateIndex
CREATE INDEX "patient_outcomes_region_idx" ON "patient_outcomes"("region");

-- CreateIndex
CREATE INDEX "operational_metrics_facility_idx" ON "operational_metrics"("facility");

-- CreateIndex
CREATE INDEX "operational_metrics_period_idx" ON "operational_metrics"("period");

-- CreateIndex
CREATE INDEX "operational_metrics_region_idx" ON "operational_metrics"("region");

-- CreateIndex
CREATE INDEX "financial_records_facility_idx" ON "financial_records"("facility");

-- CreateIndex
CREATE INDEX "financial_records_payer_idx" ON "financial_records"("payer");

-- CreateIndex
CREATE INDEX "financial_records_period_idx" ON "financial_records"("period");

-- CreateIndex
CREATE INDEX "financial_records_procedure_code_idx" ON "financial_records"("procedure_code");

-- CreateIndex
CREATE INDEX "catalog_entries_domain_idx" ON "catalog_entries"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entries_domain_table_name_column_name_key" ON "catalog_entries"("domain", "table_name", "column_name");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversation_turns_conversation_id_idx" ON "conversation_turns"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_turns_user_id_idx" ON "conversation_turns"("user_id");

-- CreateIndex
CREATE INDEX "pinned_visualizations_user_id_idx" ON "pinned_visualizations"("user_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_visualizations" ADD CONSTRAINT "pinned_visualizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
