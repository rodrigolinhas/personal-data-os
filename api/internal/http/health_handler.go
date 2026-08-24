package http

import (
	"encoding/json"
	"net/http"
)

// HealthResponse represents the health check response payload.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service,omitempty"`
	Version string `json:"version,omitempty"`
}

// HandleHealth returns the system health status.
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(HealthResponse{
		Status:  "ok",
		Service: "personal-data-os-api",
		Version: "0.1.0",
	})
}
