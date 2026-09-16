package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"personal-data-os/api/db/sqlc"
	"personal-data-os/api/internal/sleep"
)

const (
	defaultPaginationLimit  = 20
	maximumPaginationLimit  = 100
	defaultPaginationOffset = 0
)

// SleepService defines the business operations required by the SleepHandler.
type SleepService interface {
	Create(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error)
	List(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error)
	Update(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error)
	Delete(ctx context.Context, id int64) error
}

// SleepHandler handles HTTP transport for the Sleep Tracking domain.
type SleepHandler struct {
	service SleepService
}

// NewSleepHandler constructs a new SleepHandler.
func NewSleepHandler(service SleepService) *SleepHandler {
	return &SleepHandler{service: service}
}

// CreateSleepRequest defines the incoming JSON payload for creating or updating a sleep record.
type CreateSleepRequest struct {
	Date     *string `json:"date"`
	Bedtime  *string `json:"bedtime"`
	WakeTime *string `json:"wake_time"`
	Quality  *int    `json:"quality"`
	Notes    *string `json:"notes"`
}

// parseIDParam parses and validates the {id} path parameter.
// Returns (id, nil) on success, or (0, error) with an already-written 400 response on failure.
func parseIDParam(r *http.Request) (int64, error) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid id %q: must be a positive integer", raw)
	}
	return id, nil
}

// validateSleepInput validates the fields shared by Create and Update requests.
// Returns nil on success, or a slice of ErrorDetails.
func validateSleepInput(req *CreateSleepRequest) []ErrorDetail {
	var details []ErrorDetail

	if req.Date == nil || strings.TrimSpace(*req.Date) == "" {
		details = append(details, ErrorDetail{Field: "date", Issue: "date is required"})
	} else if _, err := time.Parse("2006-01-02", *req.Date); err != nil {
		details = append(details, ErrorDetail{Field: "date", Issue: "invalid date format, expected YYYY-MM-DD"})
	}

	var validBedtime, validWakeTime bool
	if req.Bedtime == nil || strings.TrimSpace(*req.Bedtime) == "" {
		details = append(details, ErrorDetail{Field: "bedtime", Issue: "bedtime is required"})
	} else if _, _, _, err := sleep.ParseTimeOfDay(*req.Bedtime); err != nil {
		details = append(details, ErrorDetail{Field: "bedtime", Issue: "invalid bedtime format, expected HH:MM"})
	} else {
		validBedtime = true
	}

	if req.WakeTime == nil || strings.TrimSpace(*req.WakeTime) == "" {
		details = append(details, ErrorDetail{Field: "wake_time", Issue: "wake_time is required"})
	} else if _, _, _, err := sleep.ParseTimeOfDay(*req.WakeTime); err != nil {
		details = append(details, ErrorDetail{Field: "wake_time", Issue: "invalid wake_time format, expected HH:MM"})
	} else {
		validWakeTime = true
	}

	if req.Quality == nil {
		details = append(details, ErrorDetail{Field: "quality", Issue: "quality is required"})
	} else if *req.Quality < 1 {
		details = append(details, ErrorDetail{Field: "quality", Issue: "must be >= 1"})
	} else if *req.Quality > 10 {
		details = append(details, ErrorDetail{Field: "quality", Issue: "must be <= 10"})
	}

	if validBedtime && validWakeTime {
		if _, err := sleep.CalculateDuration(*req.Bedtime, *req.WakeTime); errors.Is(err, sleep.ErrEqualBedtimeWakeTime) {
			details = append(details, ErrorDetail{Field: "wake_time", Issue: "bedtime and wake_time cannot be equal"})
		}
	}

	return details
}

// SleepResponse defines the public API JSON structure for a sleep record.
type SleepResponse struct {
	ID              int64   `json:"id"`
	Date            string  `json:"date"`
	Bedtime         string  `json:"bedtime"`
	WakeTime        string  `json:"wake_time"`
	DurationMinutes int32   `json:"duration_minutes"`
	Quality         int16   `json:"quality"`
	Notes           *string `json:"notes"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

// Create handles POST /api/v1/sleep.
func (h *SleepHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		slog.Error("Sleep service is nil on Create request")
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "database service unavailable", nil)
		return
	}

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req CreateSleepRequest
	if err := dec.Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", fmt.Sprintf("malformed JSON: %v", err), nil)
		return
	}

	if dec.More() {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "request body must contain a single JSON object", nil)
		return
	}

	details := validateSleepInput(&req)
	if len(details) > 0 {
		msg := "validation failed"
		if len(details) == 1 && details[0].Field == "quality" {
			msg = "quality must be an integer between 1 and 10"
		}
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", msg, details)
		return
	}

	input := sleep.CreateInput{
		Date:     *req.Date,
		Bedtime:  *req.Bedtime,
		WakeTime: *req.WakeTime,
		Quality:  int16(*req.Quality),
		Notes:    req.Notes,
	}

	record, err := h.service.Create(r.Context(), input)
	if err != nil {
		if errors.Is(err, sleep.ErrDuplicateDate) {
			RespondError(w, http.StatusConflict, "CONFLICT", "a sleep record already exists for this date", nil)
			return
		}
		slog.Error("Failed to create sleep record", "error", err)
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
		return
	}

	RespondJSON(w, http.StatusCreated, toSleepResponse(record))
}

// List handles GET /api/v1/sleep.
func (h *SleepHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		slog.Error("Sleep service is nil on List request")
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "database service unavailable", nil)
		return
	}

	limit := defaultPaginationLimit
	offset := defaultPaginationOffset

	var details []ErrorDetail

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		val, err := strconv.Atoi(limitStr)
		if err != nil || val <= 0 {
			details = append(details, ErrorDetail{Field: "limit", Issue: "limit must be a positive integer"})
		} else if val > maximumPaginationLimit {
			details = append(details, ErrorDetail{Field: "limit", Issue: fmt.Sprintf("limit must not exceed %d", maximumPaginationLimit)})
		} else {
			limit = val
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		val, err := strconv.Atoi(offsetStr)
		if err != nil || val < 0 {
			details = append(details, ErrorDetail{Field: "offset", Issue: "offset must be a non-negative integer"})
		} else {
			offset = val
		}
	}

	if len(details) > 0 {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "validation failed", details)
		return
	}

	records, err := h.service.List(r.Context(), int32(limit), int32(offset))
	if err != nil {
		slog.Error("Failed to list sleep records", "error", err)
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
		return
	}

	items := make([]SleepResponse, 0, len(records))
	for _, rec := range records {
		items = append(items, toSleepResponse(rec))
	}

	RespondJSON(w, http.StatusOK, items)
}

func toSleepResponse(log sqlc.SleepLog) SleepResponse {
	var dateStr string
	if log.Date.Valid {
		dateStr = log.Date.Time.Format("2006-01-02")
	}

	bedSec := log.Bedtime.Microseconds / 1_000_000
	bedtimeStr := fmt.Sprintf("%02d:%02d", bedSec/3600, (bedSec%3600)/60)

	wakeSec := log.WakeTime.Microseconds / 1_000_000
	wakeTimeStr := fmt.Sprintf("%02d:%02d", wakeSec/3600, (wakeSec%3600)/60)

	var notes *string
	if log.Notes.Valid {
		notes = &log.Notes.String
	}

	var createdAtStr string
	if log.CreatedAt.Valid {
		createdAtStr = log.CreatedAt.Time.UTC().Format(time.RFC3339)
	}

	var updatedAtStr string
	if log.UpdatedAt.Valid {
		updatedAtStr = log.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}

	return SleepResponse{
		ID:              log.ID,
		Date:            dateStr,
		Bedtime:         bedtimeStr,
		WakeTime:        wakeTimeStr,
		DurationMinutes: log.DurationMinutes,
		Quality:         log.Quality,
		Notes:           notes,
		CreatedAt:       createdAtStr,
		UpdatedAt:       updatedAtStr,
	}
}

// Update handles PUT /api/v1/sleep/{id}.
func (h *SleepHandler) Update(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		slog.Error("Sleep service is nil on Update request")
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "database service unavailable", nil)
		return
	}

	id, err := parseIDParam(r)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), nil)
		return
	}

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req CreateSleepRequest
	if err := dec.Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", fmt.Sprintf("malformed JSON: %v", err), nil)
		return
	}

	if dec.More() {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "request body must contain a single JSON object", nil)
		return
	}

	details := validateSleepInput(&req)
	if len(details) > 0 {
		msg := "validation failed"
		if len(details) == 1 && details[0].Field == "quality" {
			msg = "quality must be an integer between 1 and 10"
		}
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", msg, details)
		return
	}

	input := sleep.UpdateInput{
		Date:     *req.Date,
		Bedtime:  *req.Bedtime,
		WakeTime: *req.WakeTime,
		Quality:  int16(*req.Quality),
		Notes:    req.Notes,
	}

	record, err := h.service.Update(r.Context(), id, input)
	if err != nil {
		if errors.Is(err, sleep.ErrNotFound) {
			RespondError(w, http.StatusNotFound, "NOT_FOUND", "sleep record not found", nil)
			return
		}
		if errors.Is(err, sleep.ErrDuplicateDate) {
			RespondError(w, http.StatusConflict, "CONFLICT", "a sleep record already exists for this date", nil)
			return
		}
		slog.Error("Failed to update sleep record", "error", err)
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
		return
	}

	RespondJSON(w, http.StatusOK, toSleepResponse(record))
}

// Delete handles DELETE /api/v1/sleep/{id}.
func (h *SleepHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		slog.Error("Sleep service is nil on Delete request")
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "database service unavailable", nil)
		return
	}

	id, err := parseIDParam(r)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), nil)
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		if errors.Is(err, sleep.ErrNotFound) {
			RespondError(w, http.StatusNotFound, "NOT_FOUND", "sleep record not found", nil)
			return
		}
		slog.Error("Failed to delete sleep record", "error", err)
		RespondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
