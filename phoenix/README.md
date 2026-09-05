# Phoenix Hero

这是一个可降级的凤凰视觉组件。页面优先加载 `models/phoenix-bird.glb`（NORBERTO-3D
的真实凤鸟模型），用 Three.js 显示凤冠、层叠羽翼和长尾；模型网络加载失败时，自动
回退到 `phoenix-prototype.js` 的程序化凤凰海报，不影响简历阅读。

## 接入方式

在简历页面的顶部视觉区域加入一个容器，并引入样式与脚本：

```html
<div id="phoenixStage" class="phoenix-stage" aria-label="凤凰视觉效果"></div>
<link rel="stylesheet" href="phoenix/phoenix-prototype.css">
<script src="phoenix/phoenix-prototype.js"></script>
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

Three.js、GSAP、ScrollTrigger 和 GLTFLoader 会按需从 jsDelivr CDN 加载。CDN、模型或
WebGL 不可用时，组件自动保留 2D Canvas 凤凰海报；`prefers-reduced-motion: reduce`
时只渲染静态模型画面。

依赖说明：Three.js 采用 MIT 许可证；GSAP / ScrollTrigger 遵循 GreenSock 官方许可条款。公开部署前请保留其来源链接并确认项目用途符合许可范围。

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
