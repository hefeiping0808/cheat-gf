package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

const dataDictionaryRedisKey = "cheat-gf:data-dictionary"

type DataDictionaryEntry struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// EnsureDataDictionary 只补齐不存在的 item/key，避免服务重启时覆盖管理员已经修改的字段名称。
// 触发场景：首次启动或 Redis 缺少字典项；维护时新增字段必须继续采用“只补缺失值”策略。
// 更新时间：2026-09-13 13:28:55 CST。
func EnsureDataDictionary(ctx context.Context) error {
	defaults := make(map[string]string, 40)
	for i := 1; i <= 20; i++ {
		for _, prefix := range []string{"item", "key"} {
			key := fmt.Sprintf("%s%d", prefix, i)
			exists, err := redisClient.HExists(ctx, dataDictionaryRedisKey, key).Result()
			if err != nil {
				return fmt.Errorf("check data dictionary %s failed: %w", key, err)
			}
			if !exists {
				// key 的默认 label 保留原字符串，管理员可在数据字典中替换为业务名称。
				defaults[key] = key
				if prefix == "item" {
					defaults[key] = fmt.Sprintf("字段%d", i)
				}
			}
		}
	}
	if len(defaults) == 0 {
		return nil
	}
	if err := redisClient.HSet(ctx, dataDictionaryRedisKey, defaults).Err(); err != nil {
		return fmt.Errorf("seed data dictionary failed: %w", err)
	}
	return nil
}

func ListDataDictionary(ctx context.Context) ([]DataDictionaryEntry, error) {
	if err := EnsureDataDictionary(ctx); err != nil {
		return nil, err
	}
	values, err := redisClient.HGetAll(ctx, dataDictionaryRedisKey).Result()
	if err != nil {
		return nil, fmt.Errorf("read data dictionary failed: %w", err)
	}
	entries := make([]DataDictionaryEntry, 0, 40)
	for i := 1; i <= 20; i++ {
		key := fmt.Sprintf("item%d", i)
		entries = append(entries, DataDictionaryEntry{Key: key, Label: values[key]})
	}
	for i := 1; i <= 20; i++ {
		key := fmt.Sprintf("key%d", i)
		entries = append(entries, DataDictionaryEntry{Key: key, Label: values[key]})
	}
	return entries, nil
}

func IsDataDictionaryKey(key string) bool {
	key = strings.TrimSpace(key)
	prefix := ""
	switch {
	case strings.HasPrefix(key, "item"):
		prefix = "item"
	case strings.HasPrefix(key, "key"):
		prefix = "key"
	default:
		return false
	}
	index, err := strconv.Atoi(strings.TrimPrefix(key, prefix))
	return err == nil && index >= 1 && index <= 20
}

func UpdateDataDictionary(ctx context.Context, key, label string) error {
	key = strings.TrimSpace(key)
	label = strings.TrimSpace(label)
	if !IsDataDictionaryKey(key) {
		return fmt.Errorf("invalid data dictionary key")
	}
	if label == "" {
		return fmt.Errorf("data dictionary label is required")
	}
	if err := redisClient.HSet(ctx, dataDictionaryRedisKey, key, label).Err(); err != nil {
		return fmt.Errorf("update data dictionary %s failed: %w", key, err)
	}
	return nil
}

// UpdateDataDictionaryBatch 通过一次 HSet 写入批量字段，保证 Redis 不会出现只更新前半部分的中间状态。
// 触发场景：管理员同时维护 item 与 key 的展示名称；调用方负责在写入前完成完整参数校验。
// 更新时间：2026-09-13 13:28:55 CST。
func UpdateDataDictionaryBatch(ctx context.Context, updates map[string]string) error {
	if len(updates) == 0 || len(updates) > 40 {
		return fmt.Errorf("invalid data dictionary update count")
	}
	for key, label := range updates {
		if !IsDataDictionaryKey(key) || strings.TrimSpace(label) == "" || len(label) > 255 {
			return fmt.Errorf("invalid data dictionary value for %s", key)
		}
	}
	if err := redisClient.HSet(ctx, dataDictionaryRedisKey, updates).Err(); err != nil {
		return fmt.Errorf("batch update data dictionary failed: %w", err)
	}
	return nil
}
