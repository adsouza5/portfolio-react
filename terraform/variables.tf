variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "portfolio-ml-pipeline"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "github_repo" {
  description = "GitHub repo in owner/name format e.g. iadamdsouza/portfolio-react"
  type        = string
}
