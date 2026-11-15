# web-exoplasim

在浏览器里运行 [ExoPlaSim](https://github.com/alphaparrot/ExoPlaSim) 气候模式，实时查看天气与气候分布图。你可以探索地球或导入自备地形，调整行星条件，观察大气演变。

[English](README.md) · **中文**

**关于本仓库。** 这是 [ryoung48/web-exoplasim](https://github.com/ryoung48/web-exoplasim) 的个人自用分支，而后者是 ExoPlaSim 的浏览器移植版。本仓库主要供作者自己实验使用；相对原项目，改动以体验改进（QoL）为主，而不是对气候模式本身的重做。原项目的在线演示在 [ryoung48.github.io/web-exoplasim/gcm](https://ryoung48.github.io/web-exoplasim/gcm/)。

## 本仓库的改动

相对 [ryoung48/web-exoplasim](https://github.com/ryoung48/web-exoplasim)：

- **插画式行星系统面板。** 恒星、轨道与自转、行星、大气四块设置改为插画式面板，支持标准/高级两种模式，带轨道图、行星内部剖面、光谱条与大气温度/压力剖面，读数标注为估算值。
- **中文界面。** 顶栏提供 EN / 中文 切换；初始语言跟随浏览器，选择会被记住。
- **地形导入朝向。** 可旋转导入的地图，使其两极与 0° 子午线对齐到模式坐标系，并预览次恒星点与回归线/极圈。
- **恒星点与气候带叠加层**，同时用于主地图和地形导入预览。
- **潮汐锁定建议。** 轨道面板根据轨道参数估算潮汐锁定时间尺度，并建议开启或跳过「潮汐锁定」。
- **年长下限降到 10 天**（原为 60 天），便于短周期锁定行星；开启潮汐锁定后自转周期滑条被禁用，其数值跟随年长。
- **大气剖面横坐标**增加温度（K）与压力（bar）刻度。
- **估算模型改用公开文献关系**——Tout et al. (1996) 恒星拟合、常数-Q 潮汐摩擦（Goldreich & Soter 1966）、灰体大气平衡、地球能量收支比例——替换先前使用的参考实现，面板不再依赖该来源。

## GPU 与 CPU 引擎

默认的 **GPU 引擎**把 ExoPlaSim 的大气动力学与物理过程移植到 WebGPU 计算着色器，模式积分使用 **32 位单精度（FP32）**。模型在显卡上推进，GPU 不只是用来画图。它支持 T21（64 × 32）、T42（128 × 64）、T63（192 × 96），以及 5 层或 10 层大气。需要浏览器和显卡驱动支持 WebGPU。

**CPU 引擎**把 Fortran 模式编译成 WebAssembly，运行在共享内存的 Web Worker 上，模式积分保留 **64 位双精度（FP64）**。所有随附的 CPU 构建都是双精度；选择 CPU 不会使用 GPU 移植版的单精度物理。它支持 T21 和 T42。浏览器没有 WebGPU 时，页面会自动选择 CPU。

两种引擎都提供行星、恒星、轨道、大气与地表设置；实时、月平均与年平均地图；能量平衡诊断；以及存档/读档检查点。Köppen 与 Pasta 气候图使用最近十个完整模式年的对应月份平均（历史不足时用已有年份）。地形降尺度只增加视觉细节和高程修正，不会提高模拟的物理分辨率。

## 性能

以下是维护者在 **NVIDIA GeForce RTX 2070 SUPER（8 GB 显存）** 与 **AMD Ryzen 7 2700X（8 核 / 16 线程）** 上、使用 **10 层大气与 45 分钟模式时间步** 观察到的近似速度。GPU 运行为 FP32，CPU 运行为 FP64 且使用 **8 个 worker**。这些是维护者观察到的交互速率，不是受控基准测试结果。

| 分辨率 | GPU：每真实秒模拟天数 | CPU：每真实秒模拟天数 |
| --- | ---: | ---: |
| T21 | 35 | 2 |
| T42 | 10 | 0.5 |
| T63 | 1.7 | — |

T63 仅在 GPU 上可用。实际速度取决于硬件、浏览器、模式设置、诊断项以及 GPU/CPU 上同时运行的其它任务。45 分钟时间步描述的是上述测量条件，并不构成适用于所有配置的稳定性建议。

## 注意事项

这是一个实验性的简化气候模式浏览器移植版，适合探索和世界观构建；它的地图不应被当作真实区域气候的精确预测。

- **GPU 精度。** WebGPU 用单精度算术推进模式，CPU 构建用双精度。不同的舍入与并行归约会改变云、对流与湿度阈值，导致轨迹分叉。已有与 Fortran 的短期对比记录，但尚未在全部分辨率与设置下建立长期气候等价性。运行稳定、结果有限，并不等于气候准确。参见 [GPU 验证说明](docs/climate/exoplasim-webgpu.md)。
- **地球偏暖。** 本项目类地球配置在 GPU 和 CPU 上都产出过比预期更暖的气候；原生 Fortran 对比在相同页面输入下也会偏暖，所以不能只归因于 GPU 单精度。结果强烈依赖初始化和地表设置，另一组作者配方实验就得到明显更冷的气候。差异成因尚未完全定位，地球预设不是现代地球的校准复现。参见 [原生版本气候对比](docs/climate/exoplasim-native-versions.md)。
- **降水与气候带。** 运行结果可能产生过多的干夏型地中海气候（As、Cs、Ds），而实际可能更接近湿润海洋性气候。十年平均降低了对单一年份的敏感性，但不能纠正系统性降水偏差。气候带边界应谨慎对待。
- **简化的海洋与物理。** 浏览器模式使用平板海洋，而非模拟洋流与深海环流；云、对流、降水与辐射使用简化参数化。这些选择让 ExoPlaSim 更快，但也限制了区域降水、海洋热输送以及远离模型适用条件的气候。 [ExoPlaSim 论文](https://academic.oup.com/mnras/article/511/3/3272/6516962) 说明了底层模式的优缺点。
- **粗网格与预跑。** 小岛、山脉、海岸线和局部雨影分辨不足，T21 尤其明显。气候需要时间稳定；早期地图或很小的能量不平衡都不能证明各分量已经平衡。极端设置或过长的时间步也可能导致数值不稳定。
- **移植覆盖范围。** 部分诊断仅 CPU 支持，包括海平面气压和其余大气层的相对湿度。连续运行中的冰川形成尚不完整。检查点与引擎绑定。参见 [集成细节](docs/climate/exoplasim-webgpu-integration.md) 与 [冰川审计](docs/climate/exoplasim-glaciers.md)。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:5173/gcm`。CPU 模式资产已包含在 `public/gcm/` 中，运行页面不需要 Fortran 工具链。开发服务器会提供共享内存 CPU 引擎所需的跨源隔离响应头。在 GitHub Pages 上，由隔离 service worker 提供同样的支持，首次访问可能会自动重载一次。

推送到 `main` 会通过 [GitHub Pages 工作流](.github/workflows/pages.yml) 自动部署。

## 开发

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查并构建生产版本 |
| `pnpm typecheck` | 检查 TypeScript |
| `pnpm lint` | 运行 Biome（自动修复） |
| `pnpm build:gcm-wasm` | 用 Ubuntu WSL 重新构建 CPU 模式资产 |

模式代码在 `src/model/climate/gcm/`，页面在 `src/ui/gcm/`。实现、验证与基准测试细节见 [CPU 构建说明](scripts/exoplasim-wasm/README.md)、[CPU 移植笔记](docs/climate/exoplasim-wasm.md) 与 [GPU 移植笔记](docs/climate/exoplasim-webgpu.md)。

## 许可证

ExoPlaSim 与 PlaSim 以 GNU 通用公共许可证分发；本浏览器移植版是衍生作品，按 GPL-2.0 发布。随附的 [打包许可证](public/gcm/COPYING) 适用于编译后的模式资产。对应这些编译资产的模式源码是 ExoPlaSim 的 `5f8dff4` 提交（https://github.com/alphaparrot/ExoPlaSim），加上 `scripts/exoplasim-wasm/` 中的补丁。

署名：ExoPlaSim 与 PlaSim 由其作者完成，包括 Adiv Paradise 与 PlaSim 团队（Frank Lunkeit、Edilbert Kirk、Thomas Frisius、Klaus Fraedrich、Valerio Lucarini）。浏览器移植版源自 `ryoung48/web-exoplasim`。本仓库还包含进一步修改，包括 WebGPU 引擎、插画式行星系统面板、地形朝向以及能量诊断。

### 地球高程数据

随附的地球陆地高程基于 [WorldClim 2.1 高程数据](https://www.worldclim.org/data/worldclim21.html)（源自 SRTM）。源文件为 10 弧分分辨率的 `wc2.1_10m_elev.tif`，转换为应用使用的 2160 × 1080 地形栅格。见 [地形元数据](public/earth-data/earth-real-elevation.json)。

引用：Fick, S.E. and Hijmans, R.J. (2017). WorldClim 2: new 1-km spatial resolution climate surfaces for global land areas. *International Journal of Climatology*, 37, 4302–4315. [doi:10.1002/joc.5086](https://doi.org/10.1002/joc.5086)。

WorldClim 数据有独立于模式代码的条款：[WorldClim 许可证](https://www.worldclim.org/about.html) 允许学术及其它非商业用途，但再分发或商业用途需要事先许可。署名并不等于获得该许可。

地形元数据还记录了一份名为 `elev.tif` 的水深输入；其提供方与许可证尚未确认。
