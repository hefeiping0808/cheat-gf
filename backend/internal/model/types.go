package model

import "time"

// User 是认证和管理端共用的用户模型。
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Code      string    `json:"code"`
	Role      string    `json:"role"`
	Disabled  bool      `json:"disabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Visitor struct {
	ID         int64     `json:"id"`
	Module     string    `json:"module"`
	Key        string    `json:"key"`
	UserID     int64     `json:"userId"`
	IP         string    `json:"ip"`
	VisitCount int64     `json:"visitCount"`
	Item1      string    `json:"item1"`
	Item2      string    `json:"item2"`
	Item3      string    `json:"item3"`
	Item4      string    `json:"item4"`
	Item5      string    `json:"item5"`
	Item6      string    `json:"item6"`
	Item7      string    `json:"item7"`
	Item8      string    `json:"item8"`
	Item9      string    `json:"item9"`
	Item10     string    `json:"item10"`
	Item11     string    `json:"item11"`
	Item12     string    `json:"item12"`
	Item13     string    `json:"item13"`
	Item14     string    `json:"item14"`
	Item15     string    `json:"item15"`
	Item16     string    `json:"item16"`
	Item17     string    `json:"item17"`
	Item18     string    `json:"item18"`
	Item19     string    `json:"item19"`
	Item20     string    `json:"item20"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type VisitorSubmit struct {
	Module    string            `json:"module"`
	Key       string            `json:"key"`
	Token     string            `json:"token"`
	Items     map[string]string `json:"items"`
	RequestID string            `json:"requestId"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// ChangePasswordRequest 是登录用户修改密码时提交的凭据。
// 更新时间：2026-09-10 11:13:36 CST。
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type BlacklistRequest struct {
	UserID int64  `json:"userId"`
	IP     string `json:"ip"`
}

type MappingRequest struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type DataDictionaryRequest struct {
	Label string `json:"label"`
}

// BatchIDsRequest 是数据库表批量操作的统一请求格式。
// 更新时间：2026-09-13 10:05:31 CST。
type BatchIDsRequest struct {
	IDs    []int64 `json:"ids"`
	Action string  `json:"action"`
}

// DataDictionaryBatchRequest 使用逐项更新，避免把多个字段名称错误地套用到同一条记录。
// 更新时间：2026-09-13 10:05:31 CST。
type DataDictionaryBatchRequest struct {
	Updates []DataDictionaryBatchItem `json:"updates"`
}

type DataDictionaryBatchItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}
