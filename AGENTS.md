# 自学应用开发约定

这是独立应用仓库，不依赖外层 Axhub 工作区。先阅读 README.md 与相关代码；产品需求与历史规格在 docs/。

- 应用代码在 src/ 和 server/；DeepTutor 固定源码在 vendor/deeptutor/，优先在 server/book/ 实现适配。
- 禁止把 data/、data-dev/、密钥、个人材料、.venv/、.runtime/ 和 node_modules/ 纳入 Git。
- 修改后运行相关测试与 npm run build；真实模型测试会消耗额度，不将模拟结果称为真实调用成功。
- 验证使用临时数据目录，避免改写用户已有学习记录。
- 保留上游许可证及来源记录。新增运行依赖需更新锁文件及 README。
