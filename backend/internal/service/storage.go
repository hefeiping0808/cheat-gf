package service

import (
	"context"
	"fmt"
	"strings"

	_ "github.com/gogf/gf/contrib/drivers/mysql/v2"
	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/frame/g"
)

func DB() gdb.DB { return g.DB() }

// Migrate 建立业务运行所需的表，采用 IF NOT EXISTS 以便重复启动安全执行。
// 更新时间：2026-09-10 09:19:01 CST。
func Migrate(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(64) NOT NULL UNIQUE, code VARCHAR(6) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'user', disabled TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS visitors (id BIGINT PRIMARY KEY AUTO_INCREMENT, module VARCHAR(32) NOT NULL, visitor_key VARCHAR(8) NOT NULL DEFAULT 'key1', connection_status VARCHAR(8) NOT NULL DEFAULT 'offline', user_id BIGINT NOT NULL, ip VARCHAR(64) NOT NULL DEFAULT '', visit_count BIGINT NOT NULL DEFAULT 0, item1 VARCHAR(255) NOT NULL, item2 TEXT, item3 TEXT, item4 TEXT, item5 TEXT, item6 TEXT, item7 TEXT, item8 TEXT, item9 TEXT, item10 TEXT, item11 TEXT, item12 TEXT, item13 TEXT, item14 TEXT, item15 TEXT, item16 TEXT, item17 TEXT, item18 TEXT, item19 TEXT, item20 TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uk_visitor_identity (module, user_id, item1), KEY idx_visitors_user (user_id), KEY idx_visitors_ip (ip)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS blacklist (id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, ip VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uk_blacklist (user_id, ip)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS field_mappings (id BIGINT PRIMARY KEY AUTO_INCREMENT, map_key VARCHAR(64) NOT NULL UNIQUE, map_value VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS templates (id BIGINT PRIMARY KEY AUTO_INCREMENT, module VARCHAR(32) NOT NULL UNIQUE, label VARCHAR(128) NOT NULL DEFAULT '', template_keys VARCHAR(255) NOT NULL DEFAULT '', title VARCHAR(1024) NOT NULL DEFAULT '', site_title VARCHAR(255) NOT NULL DEFAULT '', form_title VARCHAR(255) NOT NULL DEFAULT '', enabled TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS visit_events (id BIGINT PRIMARY KEY AUTO_INCREMENT, module VARCHAR(32) NOT NULL, user_id BIGINT NOT NULL, visitor_id BIGINT NOT NULL DEFAULT 0, ip VARCHAR(64) NOT NULL DEFAULT '', request_id VARCHAR(128) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_visit_events_module (module), KEY idx_visit_events_ip (ip), KEY idx_visit_events_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS system_config (config_key VARCHAR(64) PRIMARY KEY, config_value TEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS audit_logs (id BIGINT PRIMARY KEY AUTO_INCREMENT, operator_id BIGINT NULL, operator_username VARCHAR(64) NOT NULL DEFAULT '', target_user_id BIGINT NULL, action VARCHAR(64) NOT NULL, target_type VARCHAR(32) NOT NULL DEFAULT '', target_ids TEXT NOT NULL, target_ref VARCHAR(255) NOT NULL DEFAULT '', request_ip VARCHAR(64) NOT NULL DEFAULT '', success TINYINT(1) NOT NULL DEFAULT 1, error_message TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_audit_operator (operator_id), KEY idx_audit_target_user (target_user_id), KEY idx_audit_action (action), KEY idx_audit_created (created_at), KEY idx_audit_success (success)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}
	for _, statement := range statements {
		if _, err := DB().Exec(ctx, statement); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	if err := ensureUserCodes(ctx); err != nil {
		return err
	}
	if err := ensureTemplateLabels(ctx); err != nil {
		return err
	}
	if err := ensureTemplateKeys(ctx); err != nil {
		return err
	}
	if err := ensureTemplateTitleLength(ctx); err != nil {
		return err
	}
	if err := ensureVisitorKeys(ctx); err != nil {
		return err
	}
	if err := ensureVisitorConnectionStatus(ctx); err != nil {
		return err
	}
	if err := resetVisitorConnectionStatus(ctx); err != nil {
		return err
	}
	for i := 1; i <= 10; i++ {
		module := fmt.Sprintf("module%d", i)
		_, err := DB().Model("templates").Data(gdb.Map{
			"module": module, "template_keys": EncodeTemplateKeys([]string{}), "title": fmt.Sprintf("模板%d", i), "enabled": 1,
		}).InsertIgnore()
		if err != nil {
			return fmt.Errorf("seed template %s failed: %w", module, err)
		}
	}
	// 2026-09-13 13:28:55 CST：启动时建立 Redis 数据字典的 40 个默认字段，已有配置保持不变。
	// 触发场景：首次部署或 Redis 中缺少部分 item/key；维护时不要全量覆盖，否则会抹掉管理员配置。
	if err := EnsureDataDictionary(ctx); err != nil {
		// Redis 暂不可用时保留数据库和认证服务，字典接口会在 Redis 恢复后自动补齐。
		g.Log().Warningf(ctx, "初始化数据字典失败: %v", err)
	}
	return nil
}

// ensureTemplateTitleLength 将已有模板标题列扩展到 1024 个字符，启动时重复执行保持幂等。
// 更新时间：2026-09-27 15:30:30 CST。
func ensureTemplateTitleLength(ctx context.Context) error {
	if _, err := DB().Exec(ctx, `ALTER TABLE templates MODIFY COLUMN title VARCHAR(1024) NOT NULL DEFAULT ''`); err != nil {
		return fmt.Errorf("expand templates.title to 1024 failed: %w", err)
	}
	return nil
}

// ensureTemplateLabels 为已有模板表补充可选的 label 字段，保留空值以便前端回退显示 module 原字符串。
// 更新时间：2026-09-13 11:35:12 CST。
func ensureTemplateLabels(ctx context.Context) error {
	if _, err := DB().Model("templates").Fields("label").Limit(1).All(); err != nil {
		if _, err = DB().Exec(ctx, `ALTER TABLE templates ADD COLUMN label VARCHAR(128) NOT NULL DEFAULT '' AFTER module`); err != nil {
			return fmt.Errorf("add templates.label failed: %w", err)
		}
	}
	return nil
}

// ensureTemplateKeys 为旧版本模板表补充 20 个 key 的配置字段，物理列避开 MySQL 保留字，空配置保持全部关闭。
// 触发场景：升级已有数据库或新建模板；上一版本自动生成的 module1~module10 全开默认值迁移为空，其他明确保存过的配置不覆盖。
// 更新时间：2026-09-13 13:35:00 CST。
func ensureTemplateKeys(ctx context.Context) error {
	if _, err := DB().Model("templates").Fields("template_keys").Limit(1).All(); err != nil {
		if _, err = DB().Exec(ctx, `ALTER TABLE templates ADD COLUMN template_keys VARCHAR(255) NOT NULL DEFAULT '' AFTER label`); err != nil {
			return fmt.Errorf("add templates.template_keys failed: %w", err)
		}
	}
	emptyKeys := EncodeTemplateKeys([]string{})
	_, err := DB().Model("templates").Where("template_keys", "").Data(gdb.Map{"template_keys": emptyKeys}).Update()
	if err != nil {
		return fmt.Errorf("backfill templates.template_keys failed: %w", err)
	}
	// 兼容当前功能上一版本写入的默认全开值，仅限定种子 module，避免覆盖其他模板的明确配置。
	seedModules := make([]string, 10)
	for i := range seedModules {
		seedModules[i] = fmt.Sprintf("module%d", i+1)
	}
	if _, err = DB().Model("templates").Where("template_keys", EncodeTemplateKeys(AllTemplateKeys())).WhereIn("module", seedModules).Data(gdb.Map{"template_keys": emptyKeys}).Update(); err != nil {
		return fmt.Errorf("migrate default templates.template_keys failed: %w", err)
	}
	return nil
}

// ensureVisitorKeys 为已有访客记录补充当前题号状态，旧记录从 key1 开始，唯一约束保持 module+user+item1 不变。
// 更新时间：2026-09-13 12:05:00 CST。
func ensureVisitorKeys(ctx context.Context) error {
	if _, err := DB().Model("visitors").Fields("visitor_key").Limit(1).All(); err != nil {
		if _, err = DB().Exec(ctx, `ALTER TABLE visitors ADD COLUMN visitor_key VARCHAR(8) NOT NULL DEFAULT 'key1' AFTER module`); err != nil {
			return fmt.Errorf("add visitors.key failed: %w", err)
		}
	}
	return nil
}

// ensureVisitorConnectionStatus 为旧访客表增加独立在线状态列，历史记录默认离线以避免伪报在线。
// 更新时间：2026-09-30 10:28:56 CST。
func ensureVisitorConnectionStatus(ctx context.Context) error {
	if _, err := DB().Model("visitors").Fields("connection_status").Limit(1).All(); err != nil {
		if _, err = DB().Exec(ctx, `ALTER TABLE visitors ADD COLUMN connection_status VARCHAR(8) NOT NULL DEFAULT 'offline' AFTER visitor_key`); err != nil {
			return fmt.Errorf("add visitors.connection_status failed: %w", err)
		}
	}
	return nil
}

// resetVisitorConnectionStatus 清理上次进程异常退出后遗留的在线标记；新进程尚无已登记的 H5 WebSocket。
// 更新时间：2026-09-30 10:28:56 CST。
func resetVisitorConnectionStatus(ctx context.Context) error {
	if _, err := DB().Model("visitors").Where("connection_status", "online").Data(map[string]any{"connection_status": "offline"}).Update(); err != nil {
		return fmt.Errorf("reset visitors.connection_status failed: %w", err)
	}
	return nil
}

// ensureUserCodes 为旧版本用户表补充 code，并在迁移完成后收紧为非空唯一字段。
// 更新时间：2026-09-10 15:12:00 CST。
func ensureUserCodes(ctx context.Context) error {
	if _, err := DB().Model("users").Fields("code").Limit(1).All(); err != nil {
		if _, err = DB().Exec(ctx, `ALTER TABLE users ADD COLUMN code VARCHAR(6) NULL UNIQUE AFTER username`); err != nil {
			return fmt.Errorf("add users.code failed: %w", err)
		}
	}
	rows, err := DB().Model("users").Fields("id,code").All()
	if err != nil {
		return fmt.Errorf("read users.code failed: %w", err)
	}
	used := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		code := strings.ToLower(strings.TrimSpace(row["code"].String()))
		if code != "" {
			used[code] = struct{}{}
		}
	}
	for _, row := range rows {
		if strings.TrimSpace(row["code"].String()) != "" {
			continue
		}
		var code string
		for {
			code, err = GenerateUserCode()
			if err != nil {
				return fmt.Errorf("generate user code failed: %w", err)
			}
			if _, exists := used[code]; !exists {
				used[code] = struct{}{}
				break
			}
		}
		if _, err = DB().Model("users").Where("id", row["id"]).Data(gdb.Map{"code": code}).Update(); err != nil {
			return fmt.Errorf("backfill users.code failed: %w", err)
		}
	}
	if _, err = DB().Exec(ctx, `ALTER TABLE users MODIFY COLUMN code VARCHAR(6) NOT NULL`); err != nil {
		return fmt.Errorf("normalize users.code failed: %w", err)
	}
	return nil
}
