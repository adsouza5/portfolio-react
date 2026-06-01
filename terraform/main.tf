terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── APIs ──────────────────────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ── Artifact Registry ─────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "backend" {
  repository_id = "backend"
  location      = var.region
  format        = "DOCKER"
  description   = "ML Pipeline backend container images"
  depends_on    = [google_project_service.apis]
}

# ── Service Account ───────────────────────────────────────────────────────────

resource "google_service_account" "ml_pipeline" {
  account_id   = "ml-pipeline-sa"
  display_name = "ML Pipeline Service Account"
  description  = "Runs the Cloud Run API — reads secrets, writes to BigQuery"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

resource "google_project_iam_member" "bq_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

resource "google_project_iam_member" "bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

# ── BigQuery ──────────────────────────────────────────────────────────────────

resource "google_bigquery_dataset" "ml_pipeline" {
  dataset_id  = "ml_pipeline"
  location    = "US"
  description = "ML pipeline prediction logs"
  depends_on  = [google_project_service.apis]
}

resource "google_bigquery_table" "predictions" {
  dataset_id          = google_bigquery_dataset.ml_pipeline.dataset_id
  table_id            = "predictions"
  deletion_protection = false
  description         = "One row per ticker per pipeline run"

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "ticker",      type = "STRING",    mode = "REQUIRED" },
    { name = "timestamp",   type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "price",       type = "FLOAT",     mode = "NULLABLE" },
    { name = "rsi",         type = "FLOAT",     mode = "NULLABLE" },
    { name = "macd_bull",   type = "BOOL",      mode = "NULLABLE" },
    { name = "above_ma50",  type = "BOOL",      mode = "NULLABLE" },
    { name = "above_ma200", type = "BOOL",      mode = "NULLABLE" },
    { name = "bb_pos",      type = "FLOAT",     mode = "NULLABLE" },
    { name = "atr",         type = "FLOAT",     mode = "NULLABLE" },
    { name = "vol_delta",   type = "FLOAT",     mode = "NULLABLE" },
    { name = "sentiment",   type = "INTEGER",   mode = "NULLABLE" },
    { name = "prediction",  type = "STRING",    mode = "NULLABLE" },
    { name = "confidence",  type = "FLOAT",     mode = "NULLABLE" },
    { name = "latency_ms",  type = "INTEGER",   mode = "NULLABLE" },
  ])
}

# ── Secret Manager ────────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "td_api_key" {
  secret_id = "td-api-key"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

# ── Workload Identity Federation (GitHub Actions — keyless auth) ───────────────

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.ml_pipeline.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Cloud Build needs to push to Artifact Registry
resource "google_project_iam_member" "sa_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

resource "google_project_iam_member" "sa_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

resource "google_project_iam_member" "sa_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.ml_pipeline.email}"
}

# ── Cloud Run ─────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name       = "ml-pipeline-api"
  location   = var.region
  depends_on = [google_project_service.apis]

  template {
    service_account                  = google_service_account.ml_pipeline.email
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/backend/api:latest"

      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
