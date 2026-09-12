package http

import (
	"encoding/json"
	"net/http"
)

// APIError represents the standard error body in Personal Data OS.
type APIError struct {
	Code    string        `json:"code"`
	Message string        `json:"message"`
	Details []ErrorDetail `json:"details,omitempty"`
}

// ErrorDetail describes a validation or parameter issue on a specific field.
type ErrorDetail struct {
	Field string `json:"field"`
	Issue string `json:"issue"`
}

// ErrorResponse wraps the APIError under the top-level "error" key.
type ErrorResponse struct {
	Error APIError `json:"error"`
}

// RespondJSON marshals data as JSON and sets the appropriate HTTP status code.
func RespondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// RespondError sends a standardized error response matching docs/api.md.
func RespondError(w http.ResponseWriter, status int, code, message string, details []ErrorDetail) {
	RespondJSON(w, status, ErrorResponse{
		Error: APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}
