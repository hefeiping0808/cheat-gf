package controller

import (
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
	// 2026-09-13 13:28:55 CST：Redis 字典固定有 item1~item20 与 key1~key20 共 40 个字段，分页在服务端切片。
	// 触发场景：管理端数据字典表格翻页，以及模板/访客页面一次读取完整 key label 映射。
	writeJSON(r, map[string]any{"list": entries[start:end], "total": len(entries)})
}

func updateDataDictionary(r *ghttp.Request) {
	key := strings.TrimSpace(r.GetRouter("key").String())
	var req model.DataDictionaryRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Label) == "" || !service.IsDataDictionaryKey(key) {
		writeError(r, http.StatusBadRequest, "数据字典字段或名称无效")
		return
	}
	if err := service.UpdateDataDictionary(requestContext(r), key, req.Label); err != nil {
		writeError(r, http.StatusInternalServerError, "保存数据字典失败")
		return
	}
	writeJSON(r, map[string]string{"message": "保存成功"})
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
	// Redis 的 HSet 一次写入整个字段集合，本身具备单命令原子性；所有参数先校验，失败不会写入部分字段。
	// 更新时间：2026-09-13 10:05:31 CST；若后续改为多条 Redis 命令，必须补充显式回滚或事务管道。
	if err := service.UpdateDataDictionaryBatch(requestContext(r), updates); err != nil {
		writeError(r, http.StatusInternalServerError, "批量保存数据字典失败: "+err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量保存成功"})
}
