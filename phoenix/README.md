# Phoenix Hero

这是一个 3D-only 凤凰视觉组件。页面加载 `models/phoenix-bird.glb`（NORBERTO-3D
的真实凤鸟模型），用 Three.js 显示凤冠、层叠羽翼和长尾；模型、WebGL 或依赖加载失败时，
舞台保持为空并显示不可用状态，不再生成 2D 替代物。

## 接入方式

在简历页面的顶部视觉区域加入一个容器，并引入样式与脚本：

```html
<div id="phoenixStage" class="phoenix-stage" aria-label="凤凰视觉效果"></div>
<link rel="stylesheet" href="phoenix/phoenix-stage.css">
<script src="phoenix/phoenix-model.js"></script>
<script>
  PhoenixHero.mount({
    container: '#phoenixStage',
    scrollTrigger: '#about',
    scrollEnd: '+=480',
    scrollDistanceDesktop: 480,
    scrollDistanceMobile: 430,
    clickable: true
  });
</script>
```

站内的 Three.js 和 GLTFLoader 会按需加载。模型或 WebGL 不可用时，
组件不会显示 2D 替代物；`prefers-reduced-motion: reduce` 时不启动动态渲染。

依赖说明：Three.js 采用 MIT 许可证。公开部署前请保留其来源链接并确认项目用途符合许可范围。

## 与简历布局配合的建议

- 将容器放在 `.hero-flight` 的 `.hero-visual` 内，并给飞行区 `position: relative;`；视觉卡片用 `position: sticky` 保持在视口中。
- 容器设置 `pointer-events: none` 可以避免挡住导航；需要点击展翼时传入 `clickable: true`。组件会在凤凰中心椭圆命中区响应鼠标/触摸，文字层仍可保持较高 `z-index`。
- 现有流体背景继续作为最底层，凤凰容器放在其上方但低于标题文字。
- 当前凤凰粒子已收敛为桌面约 220 个、移动端约 64 个；如手机发热，可在 `mount` 时传 `mobileParticleCount` 并继续下调。
- `skipIntro()` 可跳过入场，`pause()` / `resume()` 可暂停或恢复凤凰与氛围动效；页面按钮已做好保护调用。
- 组件通过 `IntersectionObserver` 和 `visibilitychange` 暂停不可见区域的渲染，便于 GitHub Pages 移动端访问。

## 模型与版权

模型来源、作者、许可证和修改说明见同目录的 `ATTRIBUTION.md`。公开部署时不要删除
该文件，也不要把 GitHub 镜像仓库的代码许可证误认为模型许可证。
