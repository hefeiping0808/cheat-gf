package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/service"
)

const maxTransferEntries = 2000

var errTemplateImportModuleMissing = errors.New("模板中包含不存在的 module")

type mappingTransferEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type mappingTransferRequest struct {
	Entries []mappingTransferEntry `json:"entries"`
}

type templateTransferEntry struct {
	Module    string   `json:"module"`
	Label     string   `json:"label"`
	Keys      []string `json:"keys"`
	Title     string   `json:"title"`
	SiteTitle string   `json:"siteTitle"`
	FormTitle string   `json:"formTitle"`
	Enabled   bool     `json:"enabled"`
}

type templateTransferRequest struct {
	Entries []templateTransferEntry `json:"entries"`
}

type dictionaryTransferRequest struct {
	Entries []service.DataDictionaryEntry `json:"entries"`
}

// exportMappings 返回全部字段映射，供管理端生成双竖线分隔的 TXT 文件。
// 触发场景：管理员点击字段映射导出；维护时导出字段需与 importMappings 的字段契约保持一致。
// 更新时间：2026-10-02 15:14:19 CST。
func exportMappings(r *ghttp.Request) {
	rows, err := service.DB().Model("field_mappings").Fields("map_key,map_value").Order("map_key ASC").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "导出字段映射失败")
		return
	}
	entries := make([]mappingTransferEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, mappingTransferEntry{Key: row["map_key"].String(), Value: row["map_value"].String()})
	}
	writeJSON(r, map[string]any{"entries": entries})
}

// importMappings 先完整校验映射唯一键和值，再以事务按 map_key 合并写入，不删除文件未包含的映射。
// 触发场景：管理员上传字段映射 TXT；维护时所有行通过校验后才允许事务写入，避免部分导入。
// 更新时间：2026-10-02 15:14:19 CST。
func importMappings(r *ghttp.Request) {
	var req mappingTransferRequest
	if err := r.Parse(&req); err != nil || len(req.Entries) == 0 || len(req.Entries) > maxTransferEntries {
		writeError(r, http.StatusBadRequest, "字段映射导入文件为空或记录数量超出限制")
		return
	}
	seen := make(map[string]struct{}, len(req.Entries))
	for index := range req.Entries {
		entry := &req.Entries[index]
		entry.Key = strings.TrimSpace(entry.Key)
		entry.Value = strings.TrimSpace(entry.Value)
		if entry.Key == "" || utf8.RuneCountInString(entry.Key) > 64 || entry.Value == "" || utf8.RuneCountInString(entry.Value) > 255 {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("第 %d 条字段映射无效", index+1))
			return
		}
		identity := strings.ToLower(entry.Key)
		if _, exists := seen[identity]; exists {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("字段映射 key 重复：%s", entry.Key))
			return
		}
		seen[identity] = struct{}{}
	}
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		for _, entry := range req.Entries {
			if _, err := tx.Model("field_mappings").Data(gdb.Map{"map_key": entry.Key, "map_value": entry.Value}).OnDuplicate("map_key").Save(); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		writeError(r, http.StatusInternalServerError, "导入字段映射失败")
		return
	}
	setAuditTargetRef(r, fmt.Sprintf("%d records", len(req.Entries)))
	writeJSON(r, map[string]int{"imported": len(req.Entries)})
}

// exportTemplates 导出模板完整可配置字段；固定 module 作为合并主键，不导出数据库内部 ID。
// 更新时间：2026-10-02 15:14:19 CST。
func exportTemplates(r *ghttp.Request) {
	rows, err := service.DB().Model("templates").Fields("module,label,template_keys,title,site_title,form_title,enabled").Order("module ASC").All()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "导出模板失败")
		return
	}
	entries := make([]templateTransferEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, templateTransferEntry{
			Module: row["module"].String(), Label: row["label"].String(),
			Keys: service.ParseTemplateKeys(row["template_keys"].String()), Title: row["title"].String(),
			SiteTitle: row["site_title"].String(), FormTitle: row["form_title"].String(), Enabled: row["enabled"].Bool(),
		})
	}
	writeJSON(r, map[string]any{"entries": entries})
}

// importTemplates 仅更新已存在的 module，验证整个文件后在单一事务中保存，避免引入不存在的模块标识。
// 更新时间：2026-10-02 15:14:19 CST。
func importTemplates(r *ghttp.Request) {
	var req templateTransferRequest
	if err := r.Parse(&req); err != nil || len(req.Entries) == 0 || len(req.Entries) > 100 {
		writeError(r, http.StatusBadRequest, "模板导入文件为空或记录数量超出限制")
		return
	}
	seen := make(map[string]struct{}, len(req.Entries))
	modules := make([]string, 0, len(req.Entries))
	for index := range req.Entries {
		entry := &req.Entries[index]
		entry.Module = strings.TrimSpace(entry.Module)
		entry.Label = strings.TrimSpace(entry.Label)
		if entry.Module == "" || utf8.RuneCountInString(entry.Label) > 128 || utf8.RuneCountInString(entry.Title) > 1024 || utf8.RuneCountInString(entry.SiteTitle) > 255 || utf8.RuneCountInString(entry.FormTitle) > 255 {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("第 %d 条模板内容无效", index+1))
			return
		}
		if _, exists := seen[entry.Module]; exists {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("模板 module 重复：%s", entry.Module))
			return
		}
		keys, err := service.NormalizeTemplateKeys(entry.Keys)
		if err != nil {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("模板 %s 的 keys 无效", entry.Module))
			return
		}
		entry.Keys = keys
		seen[entry.Module] = struct{}{}
		modules = append(modules, entry.Module)
	}
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		existing, err := tx.Model("templates").Fields("module").WhereIn("module", modules).All()
		if err != nil {
			return err
		}
		if len(existing) != len(modules) {
			return errTemplateImportModuleMissing
		}
		for _, entry := range req.Entries {
			if _, err := tx.Model("templates").Where("module", entry.Module).Data(gdb.Map{
				"label": entry.Label, "template_keys": service.EncodeTemplateKeys(entry.Keys), "title": entry.Title,
				"site_title": entry.SiteTitle, "form_title": entry.FormTitle, "enabled": entry.Enabled,
			}).Update(); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errTemplateImportModuleMissing) {
			writeError(r, http.StatusBadRequest, "模板导入文件包含不存在的 module")
		} else {
			writeError(r, http.StatusInternalServerError, "导入模板失败")
		}
		return
	}
	setAuditTargetRef(r, strings.Join(modules, ","))
	writeJSON(r, map[string]int{"imported": len(req.Entries)})
}

// exportDataDictionary 导出 Redis 中的系统默认项和自定义项，顺序与管理端列表一致。
// 更新时间：2026-10-02 15:14:19 CST。
func exportDataDictionary(r *ghttp.Request) {
	entries, err := service.ListDataDictionary(requestContext(r))
	if err != nil {
		writeError(r, http.StatusInternalServerError, "导出数据字典失败")
		return
	}
	writeJSON(r, map[string]any{"entries": entries})
}

// importDataDictionary 按 key 合并默认项或自定义项；service 使用 Redis Lua 一次性写入，未出现的 key 保持不变。
// 更新时间：2026-10-02 15:07:41 CST。
func importDataDictionary(r *ghttp.Request) {
	var req dictionaryTransferRequest
	if err := r.Parse(&req); err != nil || len(req.Entries) == 0 || len(req.Entries) > maxTransferEntries {
		writeError(r, http.StatusBadRequest, "数据字典导入文件为空或记录数量超出限制")
		return
	}
	updates := make(map[string]string, len(req.Entries))
	for index, entry := range req.Entries {
		key := strings.TrimSpace(entry.Key)
		label := strings.TrimSpace(entry.Label)
		if !service.IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("第 %d 条数据字典记录无效", index+1))
			return
		}
		if _, exists := updates[key]; exists {
			writeError(r, http.StatusBadRequest, fmt.Sprintf("数据字典 key 重复：%s", key))
			return
		}
		updates[key] = label
	}
	if err := service.UpsertDataDictionaryBatch(requestContext(r), updates); err != nil {
		writeError(r, http.StatusInternalServerError, "导入数据字典失败")
		return
	}
	setAuditTargetRef(r, fmt.Sprintf("%d records", len(updates)))
	writeJSON(r, map[string]int{"imported": len(updates)})
}
