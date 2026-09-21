package service

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const VisitorWaitingKey = "waiting"

// AllTemplateKeys 返回模板管理可配置的 20 个 key，waiting 是访客提交后的系统状态，不属于可配置项。
// 更新时间：2026-09-13 12:05:00 CST。
func AllTemplateKeys() []string {
	keys := make([]string, 20)
	for index := range keys {
		keys[index] = fmt.Sprintf("key%d", index+1)
	}
	return keys
}

func IsTemplateKey(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if !strings.HasPrefix(value, "key") {
		return false
	}
	index, err := strconv.Atoi(strings.TrimPrefix(value, "key"))
	return err == nil && index >= 1 && index <= 20
}

func NormalizeTemplateKeys(keys []string) ([]string, error) {
	selected := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		normalized := strings.ToLower(strings.TrimSpace(key))
		if !IsTemplateKey(normalized) {
			return nil, fmt.Errorf("无效的 module key: %s", key)
		}
		selected[normalized] = struct{}{}
	}
	allKeys := AllTemplateKeys()
	result := make([]string, 0, len(selected))
	for _, key := range allKeys {
		if _, ok := selected[key]; ok {
			result = append(result, key)
		}
	}
	return result, nil
}

func EncodeTemplateKeys(keys []string) string {
	data, _ := json.Marshal(keys)
	return string(data)
}

// ParseTemplateKeys 将空或非法配置按“全部关闭”处理，符合管理员显式开启 key 的安全默认值。
// 触发场景：旧模板缺少 keys 字段、数据库值为空或历史数据损坏；维护时不要把异常配置放大成可操作权限。
// 更新时间：2026-09-13 13:28:55 CST。
func ParseTemplateKeys(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	var keys []string
	if err := json.Unmarshal([]byte(raw), &keys); err != nil {
		return []string{}
	}
	normalized, err := NormalizeTemplateKeys(keys)
	if err != nil {
		return []string{}
	}
	return normalized
}

func NormalizeVisitorKey(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == VisitorWaitingKey || IsTemplateKey(normalized) {
		return normalized
	}
	return ""
}
