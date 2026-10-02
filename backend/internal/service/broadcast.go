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
	module string
	userID int64
	item1  string
}

var appSubscribers = struct {
	sync.RWMutex
	items map[appConnectionKey]map[int64]Subscriber
}{items: make(map[appConnectionKey]map[int64]Subscriber)}

type appStateLock struct {
	mu   sync.Mutex
	refs int
}

var appStateLocks = struct {
	sync.Mutex
	items map[appConnectionKey]*appStateLock
}{items: make(map[appConnectionKey]*appStateLock)}

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

// 2026-09-30 10:28:56 CST：App 连接按 module、归属用户和 item1 建立索引，并串行化同一访客的状态切换。
// 触发场景：同一访客多标签页连接/断开时保持连接状态准确，Admin 导航也只投递到对应模板。
// 维护注意：状态锁只覆盖连接状态迁移；连接关闭必须调用取消函数，避免残留订阅和锁记录。
func LockAppConnectionState(module string, userID int64, item1 string) func() {
	key := appConnectionKey{module: strings.TrimSpace(module), userID: userID, item1: strings.TrimSpace(item1)}
	appStateLocks.Lock()
	stateLock := appStateLocks.items[key]
	if stateLock == nil {
		stateLock = &appStateLock{}
		appStateLocks.items[key] = stateLock
	}
	stateLock.refs++
	appStateLocks.Unlock()
	stateLock.mu.Lock()
	return func() {
		stateLock.mu.Unlock()
		appStateLocks.Lock()
		stateLock.refs--
		if stateLock.refs == 0 {
			delete(appStateLocks.items, key)
		}
		appStateLocks.Unlock()
	}
}

func SubscribeApp(module string, userID int64, item1 string, fn Subscriber) func() {
	key := appConnectionKey{module: strings.TrimSpace(module), userID: userID, item1: strings.TrimSpace(item1)}
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

func AppConnectionCount(module string, userID int64, item1 string) int {
	key := appConnectionKey{module: strings.TrimSpace(module), userID: userID, item1: strings.TrimSpace(item1)}
	appSubscribers.RLock()
	count := len(appSubscribers.items[key])
	appSubscribers.RUnlock()
	return count
}

func PublishAppCommand(module string, userID int64, item1 string, payload any) bool {
	data, _ := json.Marshal(payload)
	key := appConnectionKey{module: strings.TrimSpace(module), userID: userID, item1: strings.TrimSpace(item1)}
	appSubscribers.RLock()
	targets := appSubscribers.items[key]
	for _, fn := range targets {
		fn(data)
	}
	connected := len(targets) > 0
	appSubscribers.RUnlock()
	return connected
}
