# 黄鼎 · 在线个人简历

这是一个纯 HTML / CSS / JavaScript 的响应式个人主页，面向课程展示与个人求职展示。页面信息已按黄鼎的最终资料整理：松山职业技术学院人工智能技术应用专业大一新生、中山、加华微捷科技有限公司 6 个月实习经历，以及 19 份压缩后的证书素材。

## 页面主线

首屏用凤凰作为“探索与成长”的视觉符号：凤凰是右侧视觉区唯一主体，周围保留火焰余烬、流动光晕和星屑装饰；鼠标或触摸滑动会带来转身、视差和火焰粒子变化，并以多频率轨迹自然漂浮。下方依次呈现教育与实习、技能、证书、兴趣媒体，二维码单独放在联系区最底部，形成从视觉吸引到联系方式的浏览路径。

## 凤凰 3D

页面优先加载 `phoenix/models/phoenix-bird.glb` 中的真实凤凰模型（NORBERTO-3D，CC BY 4.0），由 `phoenix/phoenix-model.js` 负责 Three.js 场景、动画、灯光、粒子和鼠标/触摸跟随；滚动时凤凰展翼并向下俯冲。Three.js、GLTFLoader、GSAP、ScrollTrigger 通过 jsDelivr CDN 按需加载，滚动交互在模型层也提供原生监听，确保 GitHub Pages 等静态部署环境可用。

- CDN 或 WebGL 不可用时，自动保留 2D 凤凰海报，不影响简历阅读。
- `prefers-reduced-motion` 用户默认使用静态海报。
- IntersectionObserver、页面可见性、设备像素比上限和移动端粒子降级用于控制性能。
- 桌面端按需加载 WebGL Fluid Enhanced（MIT）作为鼠标跟随的流动背景；手机端自动降级为轻量 Canvas，避免同时运行两个大型 WebGL 场景。
- 如果模型、CDN 或 WebGL 不可用，会自动切换到 `phoenix-prototype.js` 的程序化凤凰海报；公开发布时请保留 `phoenix/ATTRIBUTION.md` 和页脚中的 NORBERTO-3D / CC BY 4.0 署名。

## 主要功能

- PC、平板、手机响应式布局，支持浅色 / 深色主题。
- 19 份证书按“云计算 / AIGC（6）”“大模型工程（7）”“AI 大学堂（3）”“Python / 训练师（3）”筛选；默认通过横向 3D 旋转展厅浏览，支持鼠标滚轮、键盘和手机左右滑动，完整网格列表可按需展开。
- 所有证书、生活照片和二维码均可点击，在灯箱中查看高清原图。
- 右下角音乐播放器默认不自动播放，访客点击后按需加载并播放；支持播放 / 暂停、进度拖动和循环。
- “坦克大战小游戏”视频默认只加载封面，点击封面后再加载并播放 `media/坦克大战小游戏.mp4`。
- 证书展厅使用磨砂玻璃底板，并保留背景流体光斑的透视效果；运动与专注使用 `media/go.jpg`，生活记录使用 `media/a (2).jpg`，游戏成就使用 `media/a.jpg`。
- “浪尖儿坦克大战”卡片可直接打开 GitHub Pages 在线游戏。
- 精选项目区新增“知脉·校园知识库智能问答”，通过新窗口打开在线 RAG 全库图谱页面：`https://zhimai-rag-knowledge.pages.dev/全库图谱?refresh=1`；简历首屏也提供“体验校园 AI 助手”快捷入口。当前采用外链方式接入，避免 GitHub Pages 静态站点与 Cloudflare Pages 应用之间的跨域嵌入问题。
- 游戏入口采用“浪尖儿·战场”启动卡片：HD 标识、播放图标、在线状态和启动按钮集中在同一张卡片中。
- 一键打印 / 导出 PDF、复制邮箱、键盘操作、阅读模式和动画降级；首屏提供邮箱、电话与 GitHub 快捷入口。

## 本地预览与部署

直接双击 `index.html`（地址栏以 `file:///` 或“文件 C:/…”开头）时，浏览器会阻止 GLB 模型的跨文件读取，因此只能看到备用凤凰；这不是模型损坏。要显示真实 3D 凤凰，请通过静态服务器打开，例如 `http://127.0.0.1:8765/index.html`（或 VS Code Live Server），也可以直接使用 GitHub Pages 网址。将整个 `online-resume` 文件夹上传到 GitHub Pages、Vercel、Netlify 或 Gitee Pages 即可。发布根目录必须直接包含 `index.html`、`style.css`、`script.js`、`phoenix/` 和 `media/`。

## 资源说明

证书已从 PNG 压缩为 JPG，原 `3.png` 证书对应 `media/3a.jpg`，新增华为证书使用压缩后的 `media/az.jpg`（原始 `az.png` 保留备份）；`media/3.jpg` 专用于微信二维码，不能与证书混用。页面只引用压缩后的证书文件，未引用 `no.jpg`。
