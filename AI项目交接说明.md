# 黄鼎个人简历与项目交接说明

## 1. 项目身份

- 姓名：黄鼎
- 身份：大一新生
- 专业：人工智能技术应用
- 学校：松山职业技术学院
- 所在地：中山
- 邮箱：230893812@qq.com
- GitHub：230893812-a11y
- 个人简历仓库：<https://github.com/230893812-a11y/improved-octo-palm-tree>
- 目标网站：<https://230893812-a11y.github.io/improved-octo-palm-tree/>

## 2. 交给其他 AI 的任务说明

你正在协助维护黄鼎的在线个人简历和作品集。修改时必须：

1. 保留已有内容和文件，不要擅自删除凤凰模型、证书、视频、音乐或坦克大战。
2. 优先保证电脑端和手机端都能打开。
3. 不要把外部服务包装成黄鼎独立开发的系统；如果只是接入或体验，应使用“接入展示”“实践原型”等真实表述。
4. 不要在前端、GitHub 或日志中写入 API Key、Bearer Token、密码或其他凭证。
5. 修改后检查相对路径、页面加载、JavaScript 语法和 GitHub Pages 兼容性。
6. 视觉效果可以丰富，但正文必须清晰，凤凰不能遮挡姓名和简历文字。

## 3. 当前个人简历功能

### 首屏与视觉

- 暖白、暗青、橙红、黄色为主色。
- 首屏突出“黄鼎”。
- 首屏定位文案：

  > 人工智能技术应用专业大一新生｜关注 AI 工具、Web 交互与知识库应用，通过持续实践积累项目开发能力。

- 使用真实 GLB 凤凰模型，支持 Three.js/WebGL 交互。
- 有静态凤凰备用画面。
- 需要兼容桌面端和移动端。

### 简历内容

- 个人基本信息、教育背景、专业技能。
- 加华微捷科技有限公司实习6个月。
- 实习描述：协助组长整理任务流程、统一信息记录方式并跟进执行，减少重复沟通，团队协作效率得到提升，工作表现获得主管表扬。
- 19张证书，按云计算/AIGC、大模型工程、AI大学堂、训练师等方向分类。
- 证书支持点击查看高清原图。
- 音乐播放器。
- 坦克大战视频，使用封面并点击后加载。
- 联系方式、GitHub、二维码区域。

## 4. 当前项目区

### 项目01：3D交互式个人简历

- 技术：HTML、CSS、JavaScript、Three.js、WebGL。
- 负责：页面布局、凤凰视觉、证书交互、响应式适配和项目入口整合。

### 项目02：浪尖儿坦克大战

- 技术：HTML5 Canvas、JavaScript、CSS、GitHub Pages。
- 轻量版入口：`tank-battle-fast/index.html?v=20260905-hitfix`
- 完整版入口：旧 Pygbag/GitHub Pages 版本。
- 功能：坦克移动、射击、敌人 AI、碰撞、血量、分数、爆炸效果、音效、暂停、重新开始、手机操作。
- 手机端：移动摇杆/方向控制和独立发射按钮。
- 地图：左、中、右分布的统一大小障碍物，中央有“HD”砖块标识。
- 注意：坦克外形保持原有方形样式，不要擅自改成其他模型。

### 项目03：知脉·校园知识库智能问答

- 定位：面向大学新生的校园知识库 RAG 智能问答实践原型。
- 当前是外部在线应用入口，不应描述为完全独立开发的后端系统。
- 简历表述：资料整理、知识切分、检索配置、提示词设计、前端交互与测试验证。
- 在线入口：<https://zhimai-rag-knowledge.pages.dev/全库图谱?refresh=1>

### 项目04：API模型路由一致性检测工具

- GitHub：<https://github.com/230893812-a11y/miniature-fiesta>
- 技术：Python、HTTP API、JSON、Bearer鉴权、自动化测试、日志。
- 功能：检查请求模型与接口返回的 `model` 字段是否一致；支持批量模型、多轮测试、异常状态记录、代理配置、SSL验证开关、日志和退出码。
- 简历表述：独立开发 Python API 模型路由一致性检测工具，支持批量测试、多轮统计、异常识别和日志记录。
- 不要声称它能证明后端一定是官方模型，只能说明接口行为与返回字段的一致性风险。

## 5. 关键目录结构

```text
huang-ding-online-resume-final-v7/
├─ index.html                 # 个人简历主页面
├─ style.css                  # 页面样式与响应式布局
├─ script.js                  # 页面交互、证书、播放器等逻辑
├─ media/                     # 证书、视频、音乐、封面和备用图片
├─ phoenix/                   # 凤凰模型、Three.js/WebGL相关文件
├─ tank-battle-fast/          # 轻量坦克大战
│  ├─ index.html
│  ├─ style.css
│  ├─ game.js
│  └─ README.md
├─ certificate-3d-mockup.html
├─ certificate-vertical-glass-mockup.html
├─ .nojekyll
└─ README.md
```

本地简历目录：

`C:\Users\HD\Documents\Codex\2026-08-30\3-1-html-3-2-1\outputs\huang-ding-online-resume-final-v7`

## 6. 本地运行

在简历目录启动静态服务器：

```powershell
C:\Users\HD\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m http.server 8770
```

然后打开：<http://127.0.0.1:8770/index.html>

轻量坦克大战也可以单独在其目录启动服务器，例如端口8781。

## 7. GitHub Pages 部署

将 `huang-ding-online-resume-final-v7` 目录内的全部网站文件上传到仓库根目录，不要只上传 `index.html`。在仓库 Settings → Pages 中选择：

- Deploy from a branch
- Branch：`main`
- Folder：`/ (root)`

部署地址：

<https://230893812-a11y.github.io/improved-octo-palm-tree/>

## 8. 已知问题和维护规则

- GitHub Pages只能运行静态HTML/CSS/JavaScript，不能直接运行Python后端。
- API检测工具应作为源码项目和静态介绍展示，不能把API Key放进简历网站。
- 外部RAG服务或外部模型的真实运行由对应平台负责。
- 视频使用 `preload="none"`，不要改成首屏自动加载。
- 轻量坦克大战的脚本带有版本查询参数，用于避免旧缓存；更新 `game.js` 后同步修改版本参数。
- 修改后至少检查：`node --check game.js`、页面HTTP状态、相对资源路径、手机布局和按钮可用性。
- 不要删除原 Pygbag 版本和备份文件，除非黄鼎明确要求。

## 9. 推荐的下一步

1. 为API检测项目增加脱敏示例日志和静态结果仪表盘。
2. 为坦克大战增加更清晰的开始说明和关卡反馈，但保持快速加载。
3. 如果继续建设RAG项目，逐步补齐自己的数据处理、检索、后端接口、来源引用和测试记录。
4. 保持简历同时提供“视觉展示模式”和“标准阅读/打印模式”。
