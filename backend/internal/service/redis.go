package service

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

var redisClient = redis.NewClient(&redis.Options{
	Addr:     ConfigString("redis.address", "127.0.0.1:6379"),
	Password: ConfigString("redis.pass", "qq837226"),
	DB:       11,
})

func Redis() *redis.Client { return redisClient }

func SetRequestOnce(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return redisClient.SetNX(ctx, key, 1, ttl).Result()
}
