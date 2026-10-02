package controller

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/model"
	"backend/internal/service"
)

func listDataDictionary(r *ghttp.Request) {
	entries, err := service.ListDataDictionary(requestContext(r))
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取数据字典失败")
		return
	}
	page, pageSize := queryPage(r)
	start := (page - 1) * pageSize
	if start >= len(entries) {
		writeJSON(r, map[string]any{"list": []service.DataDictionaryEntry{}, "total": len(entries)})
		return
	}
	end := start + pageSize
	if end > len(entries) {
		end = len(entries)
	}
	// 2026-09-30 01:47:55 CST：除系统默认字段外，Redis 字典也包含管理员新建的自定义项，分页统一按实际总量切片。
	// 触发场景：管理端列表翻页；模板/访客页面仍可一次读取 key 与 label 映射。
	writeJSON(r, map[string]any{"list": entries[start:end], "total": len(entries)})
}

// createDataDictionary 新增系统默认项或自定义项；key 唯一，重复时返回冲突以避免覆盖已有 label。
// 更新时间：2026-09-30 01:47:55 CST。
func createDataDictionary(r *ghttp.Request) {
	var req model.DataDictionaryCreateRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, "数据字典参数无效")
		return
	}
	key := strings.TrimSpace(req.Key)
	label := strings.TrimSpace(req.Label)
	if !service.IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
		writeError(r, http.StatusBadRequest, "数据字典字段或名称无效")
		return
	}
	setAuditTargetRef(r, key)
	if err := service.CreateDataDictionary(requestContext(r), key, label); err != nil {
		if errors.Is(err, service.ErrDataDictionaryExists) {
			writeError(r, http.StatusConflict, "数据字典字段已存在")
			return
		}
		writeError(r, http.StatusInternalServerError, "新增数据字典失败")
		return
	}
	writeJSON(r, map[string]string{"message": "新增成功"})
}

func updateDataDictionary(r *ghttp.Request) {
	key := strings.TrimSpace(r.GetRouter("key").String())
	var req model.DataDictionaryRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Label) == "" || len(strings.TrimSpace(req.Label)) > 255 || !service.IsDataDictionaryKey(key) {
		writeError(r, http.StatusBadRequest, "数据字典字段或名称无效")
		return
	}
	if err := service.UpdateDataDictionary(requestContext(r), key, req.Label); err != nil {
		if errors.Is(err, service.ErrDataDictionaryNotFound) {
			writeError(r, http.StatusNotFound, "数据字典字段不存在")
			return
		}
		writeError(r, http.StatusInternalServerError, "保存数据字典失败")
		return
	}
	writeJSON(r, map[string]string{"message": "保存成功"})
}

// deleteDataDictionary 删除指定 key；默认项删除后由初始化标记阻止启动时重新补回。
// 更新时间：2026-09-30 01:47:55 CST。
func deleteDataDictionary(r *ghttp.Request) {
	key := strings.TrimSpace(r.GetRouter("key").String())
	if !service.IsDataDictionaryKey(key) {
		writeError(r, http.StatusBadRequest, "数据字典字段无效")
		return
	}
	if err := service.DeleteDataDictionary(requestContext(r), key); err != nil {
		if errors.Is(err, service.ErrDataDictionaryNotFound) {
			writeError(r, http.StatusNotFound, "数据字典字段不存在")
			return
		}
		writeError(r, http.StatusInternalServerError, "删除数据字典失败")
		return
	}
	writeJSON(r, map[string]string{"message": "删除成功"})
}

func batchDataDictionary(r *ghttp.Request) {
	var req model.DataDictionaryBatchRequest
	if err := r.Parse(&req); err != nil || len(req.Updates) == 0 || len(req.Updates) > 40 {
		writeError(r, http.StatusBadRequest, "数据字典批量参数无效")
		return
	}
	updates := make(map[string]string, len(req.Updates))
	for _, item := range req.Updates {
		key := strings.TrimSpace(item.Key)
		label := strings.TrimSpace(item.Label)
		if !service.IsDataDictionaryKey(key) || label == "" || len(label) > 255 {
			writeError(r, http.StatusBadRequest, "数据字典字段或名称无效")
			return
		}
		if _, exists := updates[key]; exists {
			writeError(r, http.StatusBadRequest, "数据字典字段不能重复")
			return
		}
		updates[key] = label
	}
	keys := make([]string, 0, len(updates))
	for key := range updates {
		keys = append(keys, key)
	}
	setAuditTargetRef(r, strings.Join(keys, ","))
	// 2026-09-30 01:47:55 CST：批量脚本先完整确认目标都存在再写入，避免旧页面提交时复活已删除字段。
	if err := service.UpdateDataDictionaryBatch(requestContext(r), updates); err != nil {
		if errors.Is(err, service.ErrDataDictionaryNotFound) {
			writeError(r, http.StatusNotFound, "部分数据字典字段已不存在，未执行更新")
			return
		}
		writeError(r, http.StatusInternalServerError, "批量保存数据字典失败: "+err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量保存成功"})
}
