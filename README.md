# GPT Image 2 App

基于 OpenAI gpt-image-2 接口的图片生成 Android 应用，支持 APIMart 和 DM-Fox 两个供应商。

## 功能特性

- 文生图 / 图生图 / 多图合成
- 支持 APIMart（异步）和 DM-Fox（同步）两种 API 模式
- Android 原生应用（Capacitor），支持保存到相册
- 文件夹管理、批量操作、拖拽排序
- 检查更新、自动下载安装 APK
- 画笔蒙版编辑
- 参数面板、历史记录搜索

## 技术栈

- React 19 + TypeScript + Vite
- Zustand 状态管理
- Tailwind CSS
- Capacitor 8 (Android)

## 开发

```bash
npm install
npm run dev
```

## 构建 Android

```bash
npm run build
npx cap sync android
npx cap open android
```

## 致谢

本项目最初参考了 [gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) 的项目结构和部分 UI 设计，后进行了大幅重构和功能扩展。感谢原作者 [CookSleep](https://github.com/CookSleep) 的开源贡献。

## 许可证

[MIT License](LICENSE)
