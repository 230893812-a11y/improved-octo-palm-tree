# 凤凰视觉素材与依赖说明

## 凤凰模型（必须保留署名）

首页默认使用 NORBERTO-3D 发布的 **phoenix bird** 模型。模型文件为
`models/phoenix-bird.glb`，页面仅做了尺寸、灯光和交互适配，没有改变原始模型的
作者归属。

- 作者：NORBERTO-3D
- 模型名称：phoenix bird
- 来源：[Sketchfab 模型页面](https://sketchfab.com/3d-models/phoenix-bird-844ba0cf144a413ea92c779f18912042)
- 许可证：[Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- 使用说明：允许在课程作业、个人主页和商业网站中使用；发布时必须保留作者、来源和许可证链接。
- 修改说明：仅进行了网页端缩放、灯光、粒子和鼠标/触摸/滚动交互适配。

建议在网页页脚、项目 README 或部署说明中保留下面这段署名：

> Phoenix bird by NORBERTO-3D, licensed under CC BY 4.0. Source: Sketchfab.

## 视觉与依赖

当前页面只使用本地 `phoenix-bird.glb` 3D 模型；模型下载失败、浏览器不支持 WebGL 或用户
启用了减少动态效果时，不会生成 2D 替代物。

运行时按需加载：

- [Three.js](https://github.com/mrdoob/three.js)，MIT License
