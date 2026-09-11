package sleep_test

import (
	"errors"
	"testing"

	"personal-data-os/api/internal/sleep"
)

func TestCalculateDuration(t *testing.T) {
	tests := []struct {
		name        string
		bedtime     string
		wakeTime    string
		expectedDur int32
		expectedErr error
	}{
		{
			name:        "Overnight crossing midnight (23:30 -> 07:00)",
			bedtime:     "23:30",
			wakeTime:    "07:00",
			expectedDur: 450,
			expectedErr: nil,
		},
		{
			name:        "Overnight crossing midnight (22:00 -> 06:30)",
			bedtime:     "22:00",
			wakeTime:    "06:30",
			expectedDur: 510,
			expectedErr: nil,
		},
		{
			name:        "Same day early morning (01:00 -> 08:00)",
			bedtime:     "01:00",
			wakeTime:    "08:00",
			expectedDur: 420,
			expectedErr: nil,
		},
		{
			name:        "Equal bedtime and wake time (08:00 -> 08:00)",
			bedtime:     "08:00",
			wakeTime:    "08:00",
			expectedDur: 0,
			expectedErr: sleep.ErrEqualBedtimeWakeTime,
		},
		{
			name:        "Short midnight cross (23:59 -> 00:01)",
			bedtime:     "23:59",
			wakeTime:    "00:01",
			expectedDur: 2,
			expectedErr: nil,
		},
		{
			name:        "Long same day duration (00:00 -> 23:59)",
			bedtime:     "00:00",
			wakeTime:    "23:59",
			expectedDur: 1439,
			expectedErr: nil,
		},
		{
			name:        "Time format with seconds supported (23:30:00 -> 07:00:00)",
			bedtime:     "23:30:00",
			wakeTime:    "07:00:00",
			expectedDur: 450,
			expectedErr: nil,
		},
		{
			name:        "Invalid bedtime format",
			bedtime:     "25:00",
			wakeTime:    "07:00",
			expectedDur: 0,
			expectedErr: sleep.ErrInvalidTimeFormat,
		},
		{
			name:        "Invalid wake time format",
			bedtime:     "23:30",
			wakeTime:    "invalid",
			expectedDur: 0,
			expectedErr: sleep.ErrInvalidTimeFormat,
		},
		{
			name:        "Empty bedtime",
			bedtime:     "",
			wakeTime:    "07:00",
			expectedDur: 0,
			expectedErr: sleep.ErrInvalidTimeFormat,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dur, err := sleep.CalculateDuration(tt.bedtime, tt.wakeTime)
			if tt.expectedErr != nil {
				if err == nil {
					t.Fatalf("expected error wrapping %v, got nil", tt.expectedErr)
				}
				if !errors.Is(err, tt.expectedErr) {
					t.Fatalf("expected error %v, got %v", tt.expectedErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if dur != tt.expectedDur {
				t.Errorf("expected duration %d, got %d", tt.expectedDur, dur)
			}
		})
	}
}
