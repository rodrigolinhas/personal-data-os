package sleep

import (
	"errors"
	"fmt"
	"time"
)

var (
	// ErrEqualBedtimeWakeTime is returned when bedtime and wake_time are identical.
	ErrEqualBedtimeWakeTime = errors.New("bedtime and wake_time cannot be equal")

	// ErrInvalidTimeFormat is returned when a time string cannot be parsed.
	ErrInvalidTimeFormat = errors.New("invalid time format, expected HH:MM")
)

// ParseTimeOfDay parses a local time string (HH:MM or HH:MM:SS) and returns the hour, minute, and second.
func ParseTimeOfDay(s string) (hour int, minute int, second int, err error) {
	var t time.Time
	t, err = time.Parse("15:04", s)
	if err != nil {
		t, err = time.Parse("15:04:05", s)
		if err != nil {
			return 0, 0, 0, fmt.Errorf("%w: %s", ErrInvalidTimeFormat, s)
		}
	}
	return t.Hour(), t.Minute(), t.Second(), nil
}

// CalculateDuration computes the sleep duration in minutes given bedtime and wake_time.
//
// Rules:
//   - If bedtime == wake_time: returns ErrEqualBedtimeWakeTime.
//   - If wake_time > bedtime: wake_time - bedtime (same-day sleep).
//   - If wake_time < bedtime: (1440 - bedtime) + wake_time (overnight sleep crossing midnight).
func CalculateDuration(bedtimeStr, wakeTimeStr string) (int32, error) {
	bedHour, bedMin, _, err := ParseTimeOfDay(bedtimeStr)
	if err != nil {
		return 0, fmt.Errorf("invalid bedtime: %w", err)
	}

	wakeHour, wakeMin, _, err := ParseTimeOfDay(wakeTimeStr)
	if err != nil {
		return 0, fmt.Errorf("invalid wake_time: %w", err)
	}

	bedTotalMinutes := bedHour*60 + bedMin
	wakeTotalMinutes := wakeHour*60 + wakeMin

	if bedTotalMinutes == wakeTotalMinutes {
		return 0, ErrEqualBedtimeWakeTime
	}

	var durationMinutes int
	if wakeTotalMinutes > bedTotalMinutes {
		durationMinutes = wakeTotalMinutes - bedTotalMinutes
	} else {
		durationMinutes = (24*60 - bedTotalMinutes) + wakeTotalMinutes
	}

	return int32(durationMinutes), nil
}
