package service

import "sync/atomic"

var activeConnections int64

func ConnectionOpened()            { atomic.AddInt64(&activeConnections, 1) }
func ConnectionClosed()            { atomic.AddInt64(&activeConnections, -1) }
func ActiveConnectionCount() int64 { return atomic.LoadInt64(&activeConnections) }
