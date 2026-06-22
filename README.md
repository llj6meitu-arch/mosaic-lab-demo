# Mosaic Lab Demo

这是一个零依赖的马赛克拼贴静态 Demo。

## 如何打开

直接用浏览器打开 `index.html` 即可体验。

如果浏览器对本地文件有限制，也可以在这个目录启动一个静态服务，例如：

```bash
python3 -m http.server 5173
```

然后访问：

```text
http://localhost:5173
```

## 已实现

- 上传 JPG / PNG / WebP 图片。
- 自动裁剪为 3:4 画布。
- Canvas 网格切分。
- 轻度打乱模式。
- 大量重构模式。
- 重新随机。
- 点击两个格子交换内容。
- 将选中格子变成纯色色块。
- 恢复选中格子为原图。
- 调整背景色、色块色、网格密度、间距、随机强度。
- 导出 PNG。

## 文件结构

```text
mosaic-lab-demo/
├── index.html
├── styles.css
├── app.js
└── README.md
```

