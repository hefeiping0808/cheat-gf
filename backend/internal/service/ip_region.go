package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	ipRegionRedisHashKey  = "cheat-gf:ip-region:v1"
	ipRegionLimitRedisKey = "cheat-gf:ip-region:rate-limited"
)

var ErrInvalidIPAddress = errors.New("invalid IP address")

type ipRegionResult struct {
	Status     string `json:"status"`
	Country    string `json:"country"`
	RegionName string `json:"regionName"`
}

var ipRegionState = struct {
	sync.Mutex
	blockedUntil time.Time
}{}

var ipRegionHTTPClient = &http.Client{Timeout: 3 * time.Second}

var ipRegionSpecialRanges = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("10.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("172.16.0.0/12"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.88.99.0/24"),
	netip.MustParsePrefix("192.168.0.0/16"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("224.0.0.0/4"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::/128"),
	netip.MustParsePrefix("::1/128"),
	netip.MustParsePrefix("::ffff:0:0/96"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("100::/64"),
	netip.MustParsePrefix("2001::/23"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("fc00::/7"),
	netip.MustParsePrefix("fe80::/10"),
	netip.MustParsePrefix("ff00::/8"),
}

// LookupIPRegion 先查共享 Redis Hash，未命中后再查上游并缓存成功结果，不写入业务数据库。
// 触发场景：Admin 展示访客、黑名单或审计 IP；特殊地址跳过所有查询，Redis 故障时仍回退查询上游。
// 更新时间：2026-09-30 02:22:42 CST。
func LookupIPRegion(ctx context.Context, rawIP string) (string, error) {
	addr, err := netip.ParseAddr(strings.TrimSpace(rawIP))
	if err != nil {
		return "", ErrInvalidIPAddress
	}
	if addr.Is4In6() {
		addr = addr.Unmap()
	}
	addr = addr.WithZone("")
	if !isPublicLookupIP(addr) || isConfiguredIPRegionSkip(addr) {
		return "", nil
	}
	ip := addr.String()
	region, found, err := readIPRegionCache(ctx, ip)
	if err != nil {
		return lookupIPRegionUpstream(ctx, ip)
	}
	if found {
		return region, nil
	}
	return lookupIPRegionOnCacheMiss(ctx, ip)
}

func readIPRegionCache(ctx context.Context, ip string) (string, bool, error) {
	region, err := redisClient.HGet(ctx, ipRegionRedisHashKey, ip).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return region, region != "", nil
}

// lookupIPRegionOnCacheMiss 用短时 Redis 锁合并多实例的同 IP 首次回源，拿到锁后再次检查 Hash。
func lookupIPRegionOnCacheMiss(ctx context.Context, ip string) (string, error) {
	token, err := newIPRegionLockToken()
	if err != nil {
		return lookupIPRegionUpstream(ctx, ip)
	}
	lockKey := ipRegionRedisHashKey + ":lock:" + ipRegionLockID(ip)
	acquired, err := redisClient.SetNX(ctx, lockKey, token, 5*time.Second).Result()
	if err != nil {
		return lookupIPRegionUpstream(ctx, ip)
	}
	if !acquired {
		return waitForIPRegionCache(ctx, ip)
	}
	defer releaseIPRegionLock(lockKey, token)
	if region, found, err := readIPRegionCache(ctx, ip); err == nil && found {
		return region, nil
	}
	return lookupIPRegionUpstream(ctx, ip)
}

func waitForIPRegionCache(ctx context.Context, ip string) (string, error) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	timeout := time.NewTimer(3200 * time.Millisecond)
	defer timeout.Stop()
	for {
		select {
		case <-ctx.Done():
			return "", nil
		case <-timeout.C:
			return "", nil
		case <-ticker.C:
			region, found, err := readIPRegionCache(ctx, ip)
			if err != nil {
				return lookupIPRegionUpstream(ctx, ip)
			}
			if found {
				return region, nil
			}
		}
	}
}

func newIPRegionLockToken() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func ipRegionLockID(ip string) string {
	value := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(value[:])
}

func releaseIPRegionLock(lockKey, token string) {
	const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
	return redis.call('DEL', KEYS[1])
end
return 0
`
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, _ = redisClient.Eval(ctx, releaseScript, []string{lockKey}, token).Result()
}

func lookupIPRegionUpstream(ctx context.Context, ip string) (string, error) {
	if ipRegionRequestsBlocked(ctx) {
		return "", nil
	}
	endpoint := "http://ip-api.com/json/" + url.PathEscape(ip) + "?fields=status,country,regionName&lang=zh-CN"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("create IP region request failed: %w", err)
	}
	response, err := ipRegionHTTPClient.Do(request)
	if err != nil {
		return "", nil
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusTooManyRequests {
		blockIPRegionRequests(response.Header.Get("X-Ttl"))
		return "", nil
	}
	if response.StatusCode != http.StatusOK {
		return "", nil
	}
	var result ipRegionResult
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&result); err != nil || result.Status != "success" {
		return "", nil
	}
	country := strings.TrimSpace(result.Country)
	region := strings.TrimSpace(result.RegionName)
	if country == "" {
		country = "未知"
	}
	if region == "" {
		region = "未知"
	}
	location := country + "-" + region
	// 只缓存有效归属地；Redis 暂时写入失败时仍返回本次查询结果供界面展示。
	_ = redisClient.HSet(ctx, ipRegionRedisHashKey, ip, location).Err()
	if response.Header.Get("X-Rl") == "0" {
		blockIPRegionRequests(response.Header.Get("X-Ttl"))
	}
	return location, nil
}

func isPublicLookupIP(addr netip.Addr) bool {
	if !addr.IsValid() || !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsMulticast() || addr.IsUnspecified() {
		return false
	}
	for _, prefix := range ipRegionSpecialRanges {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

// isConfiguredIPRegionSkip 支持跳过部署环境中已知的公网回源地址，可配置逗号分隔 IP 或 CIDR。
// 更新时间：2026-09-30 02:13:10 CST。
func isConfiguredIPRegionSkip(addr netip.Addr) bool {
	for _, value := range strings.Split(ConfigString("ip-region.skip-ips", ""), ",") {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if skipped, err := netip.ParseAddr(value); err == nil {
			if skipped.Is4In6() {
				skipped = skipped.Unmap()
			}
			if skipped.WithZone("") == addr {
				return true
			}
			continue
		}
		if prefix, err := netip.ParsePrefix(value); err == nil && prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func ipRegionRequestsBlocked(ctx context.Context) bool {
	if time.Now().Before(ipRegionLocalBlockedUntil()) {
		return true
	}
	blocked, err := redisClient.Exists(ctx, ipRegionLimitRedisKey).Result()
	return err == nil && blocked > 0
}

func ipRegionLocalBlockedUntil() time.Time {
	ipRegionState.Lock()
	defer ipRegionState.Unlock()
	return ipRegionState.blockedUntil
}

func blockIPRegionRequests(ttlValue string) {
	ttl, err := strconv.Atoi(ttlValue)
	if err != nil || ttl < 1 {
		ttl = 60
	}
	blockedUntil := time.Now().Add(time.Duration(ttl) * time.Second)
	ipRegionState.Lock()
	ipRegionState.blockedUntil = blockedUntil
	ipRegionState.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_ = redisClient.Set(ctx, ipRegionLimitRedisKey, "1", time.Until(blockedUntil)).Err()
}
