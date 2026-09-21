package controller

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/net/ghttp"

	"backend/internal/model"
	"backend/internal/service"
)

func listMappings(r *ghttp.Request) {
	page, pageSize := queryPage(r)
	list, total, err := service.DB().Model("field_mappings").Order("map_key ASC").Page(page, pageSize).AllAndCount(false)
	if err != nil {
		writeError(r, http.StatusInternalServerError, "读取字段映射失败")
		return
	}
	writeJSON(r, map[string]any{"list": list.List(), "total": total})
}

func saveMapping(r *ghttp.Request) {
	var req model.MappingRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Key) == "" {
		writeError(r, http.StatusBadRequest, "字段 key 不能为空")
		return
	}
	_, err := service.DB().Model("field_mappings").Data(gdb.Map{"map_key": strings.TrimSpace(req.Key), "map_value": strings.TrimSpace(req.Value)}).OnDuplicate("map_key").Save()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "保存字段映射失败")
		return
	}
	writeJSON(r, map[string]string{"message": "保存成功"})
}

// 2026-09-12 00:00:00 CST：增加字段映射编辑接口，按记录 ID 更新 key/value，而不是通过新增接口产生重复记录。
// 触发场景：Admin 字段映射表格点击“编辑”并保存；维护时必须保留 map_key 唯一约束，避免 module 字段标签产生歧义。
// 维护注意：更新失败时保留数据库原记录，前端会继续显示编辑弹窗并等待用户处理。
func updateMapping(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "字段编号无效")
		return
	}
	var req model.MappingRequest
	if err := r.Parse(&req); err != nil || strings.TrimSpace(req.Key) == "" {
		writeError(r, http.StatusBadRequest, "字段 key 不能为空")
		return
	}
	_, err := service.DB().Model("field_mappings").Where("id", id).Data(gdb.Map{
		"map_key":   strings.TrimSpace(req.Key),
		"map_value": strings.TrimSpace(req.Value),
	}).Update()
	if err != nil {
		writeError(r, http.StatusInternalServerError, "更新字段映射失败")
		return
	}
	writeJSON(r, map[string]string{"message": "保存成功"})
}

func deleteMapping(r *ghttp.Request) {
	id, ok := parseID(r, "id")
	if !ok {
		writeError(r, http.StatusBadRequest, "字段编号无效")
		return
	}
	if _, err := service.DB().Model("field_mappings").Where("id", id).Delete(); err != nil {
		writeError(r, http.StatusInternalServerError, "删除字段映射失败")
		return
	}
	writeJSON(r, map[string]string{"message": "删除成功"})
}

func batchMappings(r *ghttp.Request) {
	var req model.BatchIDsRequest
	if err := r.Parse(&req); err != nil || req.Action != "delete" {
		writeError(r, http.StatusBadRequest, "字段映射批量操作无效")
		return
	}
	if err := validateBatchIDs(req.IDs); err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	setAuditTargetIDs(r, req.IDs)
	err := service.DB().Transaction(requestContext(r), func(ctx context.Context, tx gdb.TX) error {
		count, err := tx.Model("field_mappings").WhereIn("id", req.IDs).Count()
		if err != nil {
			return fmt.Errorf("读取字段映射失败: %w", err)
		}
		if count != len(req.IDs) {
			return fmt.Errorf("部分字段映射不存在，未执行任何操作")
		}
		_, err = tx.Model("field_mappings").WhereIn("id", req.IDs).Delete()
		return err
	})
	if err != nil {
		writeError(r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(r, map[string]string{"message": "批量删除成功"})
}
