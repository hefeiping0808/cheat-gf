package service

// Version 由 Linux 打包脚本通过 Go linker 注入；本地开发未注入时返回 dev。
// 触发场景：健康检查和版本接口返回当前部署版本，便于后台/H5 与运行二进制核对。
// 更新时间：2026-10-02 10:08:32 CST。
var Version = "dev"

func CurrentVersion() string {
	return Version
}
