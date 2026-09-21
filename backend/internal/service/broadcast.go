package service

import (
	"encoding/json"
	"strings"
	"sync"
	"sync/atomic"
)

type Subscriber func([]byte)

var subscribers = struct {
	sync.RWMutex
	items map[int64]map[int64]Subscriber
}{items: make(map[int64]map[int64]Subscriber)}

var nextSubscriberID int64

type appConnectionKey struct {
	userID int64
	item1  string
}

var appSubscribers = struct {
	sync.RWMutex
	items map[appConnectionKey]map[int64]Subscriber
}{items: make(map[appConnectionKey]map[int64]Subscriber)}

func Subscribe(userID int64, fn Subscriber) func() {
	subscribers.Lock()
	if subscribers.items[userID] == nil {
		subscribers.items[userID] = make(map[int64]Subscriber)
	}
	id := atomic.AddInt64(&nextSubscriberID, 1)
	subscribers.items[userID][id] = fn
	subscribers.Unlock()
	return func() {
		subscribers.Lock()
		delete(subscribers.items[userID], id)
		subscribers.Unlock()
	}
}

func PublishVisitor(userID int64, payload any) {
	data, _ := json.Marshal(payload)
	subscribers.RLock()
	for _, fn := range subscribers.items[userID] {
		fn(data)
	}
	for _, fn := range subscribers.items[0] {
		fn(data)
	}
	subscribers.RUnlock()
}

// 2026-09-10 14:35:00 CST：App 连接按归属用户和 item1 建立独立订阅索引，供 Admin 定向控制指定访客页面。
// 触发场景：同一用户下存在多个访客连接时，导航指令只能送达 item1 完全匹配的连接。
// 维护注意：item1 在注册和发布时都去除首尾空格；连接关闭必须调用返回的取消函数，避免旧连接继续接收指令。
func SubscribeApp(userID int64, item1 string, fn Subscriber) func() {
	key := appConnectionKey{userID: userID, item1: strings.TrimSpace(item1)}
	appSubscribers.Lock()
	if appSubscribers.items[key] == nil {
		appSubscribers.items[key] = make(map[int64]Subscriber)
	}
	id := atomic.AddInt64(&nextSubscriberID, 1)
	appSubscribers.items[key][id] = fn
	appSubscribers.Unlock()
	return func() {
		appSubscribers.Lock()
		delete(appSubscribers.items[key], id)
		if len(appSubscribers.items[key]) == 0 {
			delete(appSubscribers.items, key)
		}
		appSubscribers.Unlock()
	}
}

func PublishAppCommand(userID int64, item1 string, payload any) bool {
	data, _ := json.Marshal(payload)
	key := appConnectionKey{userID: userID, item1: strings.TrimSpace(item1)}
	appSubscribers.RLock()
	targets := appSubscribers.items[key]
	for _, fn := range targets {
		fn(data)
	}
	connected := len(targets) > 0
	appSubscribers.RUnlock()
	return connected
}
