-- CreateTable
CREATE TABLE "public"."inspections" (
    "id" TEXT NOT NULL,
    "original_id" TEXT NOT NULL,
    "timestamp_utc" TIMESTAMP(3) NOT NULL,
    "inspection_type" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "street" TEXT NOT NULL,
    "upstream_manhole" TEXT NOT NULL,
    "downstream_manhole" TEXT NOT NULL,
    "gps_lat" DOUBLE PRECISION,
    "gps_lon" DOUBLE PRECISION,
    "material" TEXT NOT NULL,
    "material_desc" TEXT,
    "diameter_in" INTEGER NOT NULL,
    "length_ft" DOUBLE PRECISION NOT NULL,
    "age_years" INTEGER NOT NULL,
    "shape" TEXT,
    "install_year" INTEGER,
    "slope_percent" DOUBLE PRECISION,
    "inspection_score" INTEGER NOT NULL,
    "requires_repair" BOOLEAN NOT NULL,
    "requires_cleaning" BOOLEAN,
    "severity_max" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "equipment" JSONB,
    "observations" JSONB,
    "sensor_data" JSONB,
    "crew" JSONB,
    "duration_minutes" INTEGER,
    "video_file" TEXT,
    "report_generated" BOOLEAN,
    "notes" TEXT,
    "qc_reviewed" BOOLEAN,
    "tags" TEXT[],
    "defect_count" INTEGER NOT NULL DEFAULT 0,
    "critical_defects" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."defects" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "distance_ft" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "clock_start" INTEGER,
    "clock_end" INTEGER,
    "dimensions" JSONB,
    "photo_ref" TEXT,
    "video_timestamp_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspections_original_id_key" ON "public"."inspections"("original_id");

-- CreateIndex
CREATE INDEX "inspections_city_state_idx" ON "public"."inspections"("city", "state");

-- CreateIndex
CREATE INDEX "inspections_inspection_score_idx" ON "public"."inspections"("inspection_score");

-- CreateIndex
CREATE INDEX "inspections_requires_repair_idx" ON "public"."inspections"("requires_repair");

-- CreateIndex
CREATE INDEX "inspections_material_idx" ON "public"."inspections"("material");

-- CreateIndex
CREATE INDEX "inspections_timestamp_utc_idx" ON "public"."inspections"("timestamp_utc");

-- CreateIndex
CREATE INDEX "inspections_city_requires_repair_inspection_score_idx" ON "public"."inspections"("city", "requires_repair", "inspection_score");

-- CreateIndex
CREATE INDEX "inspections_severity_max_idx" ON "public"."inspections"("severity_max");

-- CreateIndex
CREATE INDEX "inspections_material_inspection_score_idx" ON "public"."inspections"("material", "inspection_score");

-- CreateIndex
CREATE INDEX "inspections_state_requires_repair_idx" ON "public"."inspections"("state", "requires_repair");

-- CreateIndex
CREATE INDEX "inspections_defect_count_idx" ON "public"."inspections"("defect_count");

-- CreateIndex
CREATE INDEX "inspections_critical_defects_idx" ON "public"."inspections"("critical_defects");

-- CreateIndex
CREATE INDEX "defects_inspection_id_idx" ON "public"."defects"("inspection_id");

-- CreateIndex
CREATE INDEX "defects_severity_idx" ON "public"."defects"("severity");

-- CreateIndex
CREATE INDEX "defects_code_idx" ON "public"."defects"("code");

-- CreateIndex
CREATE INDEX "defects_category_idx" ON "public"."defects"("category");

-- CreateIndex
CREATE INDEX "defects_severity_code_idx" ON "public"."defects"("severity", "code");

-- AddForeignKey
ALTER TABLE "public"."defects" ADD CONSTRAINT "defects_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
