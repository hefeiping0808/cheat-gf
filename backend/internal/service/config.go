package service

import (
	"context"
	"strings"

	"github.com/gogf/gf/v2/frame/g"
)

func configString(path, fallback string) string {
	v := g.Cfg().MustGet(context.Background(), path, fallback).String()
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func ConfigString(path, fallback string) string { return configString(path, fallback) }
