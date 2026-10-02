package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	dataDictionaryRedisKey       = "cheat-gf:data-dictionary"
	dataDictionaryInitRedisKey   = "cheat-gf:data-dictionary:initialized"
	dataDictionaryDefaultMaxSize = 40
)

var (
	ErrDataDictionaryExists   = errors.New("data dictionary entry already exists")
	ErrDataDictionaryNotFound = errors.New("data dictionary entry not found")
	dataDictionaryKeyPattern  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{0,63}$`)
)

type DataDictionaryEntry struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// EnsureDataDictionary 仅在首次初始化时补齐 40 个系统默认项，之后保留管理员的新增和删除结果。
// 触发场景：服务启动或读取字典；Lua 脚本一次性写入默认项和初始化标记，避免并发初始化覆盖用户改动。
// 更新时间：2026-09-30 01:47:55 CST。
func EnsureDataDictionary(ctx context.Context) error {
	args := make([]any, 0, dataDictionaryDefaultMaxSize*2)
	for _, key := range defaultDataDictionaryKeys() {
		label := key
		if strings.HasPrefix(key, "item") {
			index, _ := strconv.Atoi(strings.TrimPrefix(key, "item"))
			label = fmt.Sprintf("字段%d", index)
		}
		args = append(args, key, label)
	}
	const initializeScript = `
if redis.call('GET', KEYS[1]) then
	return 0
end
for i = 1, #ARGV, 2 do
	redis.call('HSETNX', KEYS[2], ARGV[i], ARGV[i + 1])
end
redis.call('SET', KEYS[1], '1')
return 1
`
	if _, err := redisClient.Eval(ctx, initializeScript, []string{dataDictionaryInitRedisKey, dataDictionaryRedisKey}, args...).Result(); err != nil {
		return fmt.Errorf("initialize data dictionary failed: %w", err)
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

	entries := make([]DataDictionaryEntry, 0, len(values))
	for _, key := range defaultDataDictionaryKeys() {
		if label, exists := values[key]; exists {
			entries = append(entries, DataDictionaryEntry{Key: key, Label: label})
			delete(values, key)
		}
	}
	customKeys := make([]string, 0, len(values))
	for key := range values {
		customKeys = append(customKeys, key)
	}
	sort.Strings(customKeys)
	for _, key := range customKeys {
		entries = append(entries, DataDictionaryEntry{Key: key, Label: values[key]})
	}
	return entries, nil
}

func defaultDataDictionaryKeys() []string {
	keys := make([]string, 0, dataDictionaryDefaultMaxSize)
	for i := 1; i <= 20; i++ {
		keys = append(keys, fmt.Sprintf("item%d", i))
	}
	for i := 1; i <= 20; i++ {
		keys = append(keys, fmt.Sprintf("key%d", i))
	}
	return keys
}

func IsDataDictionaryKey(key string) bool {
	return dataDictionaryKeyPattern.MatchString(strings.TrimSpace(key))
}

// IsVisitorItemKey 限制访客数据导出列为数据库真实存在的 item1~item20 列。
// 触发场景：数据字典允许自定义 key 后，导出仍不能把任意字典 key 当成访客表字段。
// 更新时间：2026-09-30 01:47:55 CST。
func IsVisitorItemKey(key string) bool {
	key = strings.TrimSpace(key)
	if !strings.HasPrefix(key, "item") {
		return false
	}
	index, err := strconv.Atoi(strings.TrimPrefix(key, "item"))
	return err == nil && index >= 1 && index <= 20
}

func CreateDataDictionary(ctx context.Context, key, label string) error {
	key = strings.TrimSpace(key)
	label = strings.TrimSpace(label)
	if !IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
		return fmt.Errorf("invalid data dictionary entry")
	}
	if err := EnsureDataDictionary(ctx); err != nil {
		return err
	}
	created, err := redisClient.HSetNX(ctx, dataDictionaryRedisKey, key, label).Result()
	if err != nil {
		return fmt.Errorf("create data dictionary %s failed: %w", key, err)
	}
	if !created {
		return ErrDataDictionaryExists
	}
	return nil
}

func UpdateDataDictionary(ctx context.Context, key, label string) error {
	key = strings.TrimSpace(key)
	label = strings.TrimSpace(label)
	if !IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
		return fmt.Errorf("invalid data dictionary entry")
	}
	if err := EnsureDataDictionary(ctx); err != nil {
		return err
	}
	const updateScript = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then
	return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
return 1
`
	updated, err := redisClient.Eval(ctx, updateScript, []string{dataDictionaryRedisKey}, key, label).Int()
	if err != nil {
		return fmt.Errorf("update data dictionary %s failed: %w", key, err)
	}
	if updated == 0 {
		return ErrDataDictionaryNotFound
	}
	return nil
}

func DeleteDataDictionary(ctx context.Context, key string) error {
	key = strings.TrimSpace(key)
	if !IsDataDictionaryKey(key) {
		return fmt.Errorf("invalid data dictionary key")
	}
	if err := EnsureDataDictionary(ctx); err != nil {
		return err
	}
	deleted, err := redisClient.HDel(ctx, dataDictionaryRedisKey, key).Result()
	if err != nil {
		return fmt.Errorf("delete data dictionary %s failed: %w", key, err)
	}
	if deleted == 0 {
		return ErrDataDictionaryNotFound
	}
	return nil
}

// UpdateDataDictionaryBatch 一次校验全部目标存在后统一更新，避免已删除的系统默认项被旧页面提交重新创建。
// 更新时间：2026-09-30 01:47:55 CST。
func UpdateDataDictionaryBatch(ctx context.Context, updates map[string]string) error {
	if len(updates) == 0 || len(updates) > dataDictionaryDefaultMaxSize {
		return fmt.Errorf("invalid data dictionary update count")
	}
	args := make([]any, 0, len(updates)*2)
	for key, label := range updates {
		key = strings.TrimSpace(key)
		label = strings.TrimSpace(label)
		if !IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
			return fmt.Errorf("invalid data dictionary value for %s", key)
		}
		args = append(args, key, label)
	}
	if err := EnsureDataDictionary(ctx); err != nil {
		return err
	}
	const batchScript = `
for i = 1, #ARGV, 2 do
	if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 0 then
		return 0
	end
end
for i = 1, #ARGV, 2 do
	redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
return 1
`
	updated, err := redisClient.Eval(ctx, batchScript, []string{dataDictionaryRedisKey}, args...).Int()
	if err != nil {
		return fmt.Errorf("batch update data dictionary failed: %w", err)
	}
	if updated == 0 {
		return ErrDataDictionaryNotFound
	}
	return nil
}
