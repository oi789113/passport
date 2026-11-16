# 护照 3D 展示

网站：https://oi789113.github.io/passport/

同一页面展示美国、台湾、香港及澳门护照，可通过顶部按钮手动切换，支持拖动旋转、缩放、自动旋转、正背面、重置及下载当前模型。模型按需载入并缓存，连续切换时仅展示最后选中的护照。

- [美国护照](https://oi789113.github.io/passport/?passport=us)
- [台湾护照](https://oi789113.github.io/passport/?passport=taiwan)
- [香港护照](https://oi789113.github.io/passport/?passport=hong-kong)
- [澳门护照](https://oi789113.github.io/passport/?passport=macau)

四份 GLB 均采用米单位，封面为 88 × 125 mm。台湾、香港及澳门模型包含嵌入的烫金、粗糙度和封皮法线贴图。

## 开发

```sh
npm ci
npm test
npm run build
```

`index.html` 使用已提交的 `viewer.bundle.js`；修改 `viewer.js` 或 `model-library.js` 后需要重新运行 build。页面和模型均为本地资源，无需外部 CDN，可直接部署到 GitHub Pages。Pages 当前从 `main` 分支根目录发布。

## 素材来源

美国封面：[United States Passport.svg](https://commons.wikimedia.org/wiki/File:United_States_Passport.svg)，Wikimedia Commons 标记为公共领域（PD-USGov）。原作者 Siirski；字体修订 FireDragonValo。

台湾封面字形与排版参考：[外交部领事局公布的新版护照封面](https://www.boca.gov.tw/cp-296-5848-c6720-1.html)，2021 年起发行。材质和书册几何为重建。

香港、澳门封面来源及香港模型的 CC BY-SA 4.0 许可见 [ASSET_LICENSES.md](ASSET_LICENSES.md)。Three.js 授权见 `THREE_LICENSE.txt`。
