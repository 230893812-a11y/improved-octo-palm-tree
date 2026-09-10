# 快速战场开源参考

本游戏保持原生 HTML、CSS 与 Canvas JavaScript 实现，不直接复制下列项目的源码或素材。以下项目用于研究玩法结构、移动端输入和后续迭代方向。

## 已参考的设计方向

- [nipplejs](https://github.com/yoannmoinet/nipplejs) — MIT License。参考移动摇杆的死区、指针状态和松手复位设计；当前摇杆为本项目自行实现，没有引入该依赖。
- [Tank 2016](https://github.com/ovidiubute/jstank2016) — MIT License。参考 Battle City 的敌人类型和关卡节奏；未使用其中来源不明的游戏素材。
- [Tank Battle Arena](https://github.com/hoangvt2501/game_tank) — GitHub 仓库未声明许可证。只参考公开 README 中的 Boss、补给和局内成长思路，不复制代码或资源。
- [JsBattle](https://github.com/jamro/jsbattle) — MIT License。作为未来“AI 坦克编程对战”方向的研究参考，当前快速模式没有加入该复杂系统。

## 当前轻量增强

- 标准、侦察和精英 Boss 三种敌人；
- 击败敌人后概率掉落生命或快速火力补给；
- Boss 必定掉落快速火力补给；
- 本地保存最高分；
- 保留原生 Canvas，无第三方运行时和额外网络请求。

## 边界

- “参考”不等于代码来自这些仓库；
- 未声明许可证的仓库不得复制源码或素材；
- 快速模式优先保证手机加载速度和操作稳定性，不引入 Phaser、p5.js 或大型素材包。
