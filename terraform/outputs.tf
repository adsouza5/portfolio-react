output "cloud_run_url" {
  description = "Cloud Run service URL — set as REACT_APP_API_URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "wif_provider" {
  description = "Workload Identity Provider — set as WIF_PROVIDER GitHub secret"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "wif_service_account" {
  description = "Service account email — set as WIF_SA GitHub secret"
  value       = google_service_account.ml_pipeline.email
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/backend"
}
