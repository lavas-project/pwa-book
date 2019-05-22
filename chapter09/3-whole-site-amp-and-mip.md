# 全站 AMP/MIP

全站 AMP/MIP，顾名思义就是指整个站点每个页面都用 AMP/MIP 来编写。由于全站 AMP 和全站 MIP 都会依赖于 AMP/MIP 运行时提供的交互机制，表 9-1 列出了能够通过 AMP/MIP 实现复杂交互的一些技术基础，并列出了 AMP 和 MIP 的一些区别。

|| AMP | MIP |
|------------|-----|-----|
|事件处理机制|支持|支持|
|页面切换过渡动画|不支持|支持|
|页面间共享数据|不支持|支持|
|shell 机制|不支持|支持|
|外部自定义组件|不支持|支持|
|自定义 JavaScript|不支持|支持|

从表 9-1 对比可知，由于 MIP 对全站的支持情况要好于 AMP，所以在本节将会使用 MIP 对全站 AMP/MIP 方案进行讲解。全站 MIP 的实际效果可以看 MIP Project 的官网（[https://www.mipengine.org](https://www.mipengine.org)），移动浏览器下效果比较明显。整站 MIP 机制可以参考 MIP 官方文档的可交互设计概述（[https://www.mipengine.org/v2/docs/interactive-mip/introduction.html](https://www.mipengine.org/v2/docs/interactive-mip/introduction.html)）

> 注意：
> 全站 MIP 指的是的开发者自己开发的独立域名的独立 MIP 页面，并不是被 MIP Cache 索引之后的页面，只是 MIP 运行时提供机制能够让 MIP 体验单页化，用户体验会更好。

## 添加 Web App Manifest

如果要将 MIP 页面改造成 PWA 的话，首先需要给 MIP 添加 Web App Manifest 特性，而 Web App Manifest 在第五章中已经有详细介绍，这里就不再赘述。具体的做法是在每个 MIP 页面的 `<head>` 中添加 `manifest.json` 文件，如下代码所示。

```html
<!doctype html>
<html amp lang="en">
  <head>
    <meta charset="utf-8">
    <script async src="https://c.mipcdn.com/static/v2/mip.js"></script>
    <title>Hello, MIP</title>
    <link rel="canonical" href="http://mipexample.org/article-metadata.html">
    <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
    <!-- 插入 manifest.json -->
    <link rel="manifest" href="./manifest.json">
  </head>
  <body>
    <!-- MIP 页面内容 -->
  </body>
</html>
```

为了保证每个 MIP 页面都能够添加到桌面，每个 MIP 页面都需要添加 `manifest.json` 文件，`manifest.json` 的内容示例如下代码所示。

```json
{
  "name": "MIP-PWA",
  "short_name": "MIP-PWA",
  "icons": [
    {
      "src": "./launcher-icon-1x.png",
      "type": "image/png",
      "sizes": "48x48"
    },
    {
      "src": "./launcher-icon-2x.png",
      "type": "image/png",
      "sizes": "96x96"
    },
    {
      "src": "./launcher-icon-4x.png",
      "type": "image/png",
      "sizes": "192x192"
    }
  ],
  "start_url": "/?standalone=1",
  "background_color": "#ffffff",
  "display": "standalone",
  "theme_color": "#1976d2"
}
```

其中需要注意的是，`start_url` 需要指定一个固定的入口 URL，当用户将 MIP 页面添加到桌面之后，可以保证用户从桌面入口进入 PWA 之后能够有一个固定的入口。

## 启用 Service Worker

MIP 页面在集成了 Web App Manifest 之后，进而需要集成并启用 Service Worker 才能让站点离线使用，加快首屏展现等。那么如何在 MIP 页面中使用 Service Worker 呢？

### 注册 Service Worker

通过第四章对 Service Worker 的介绍，通常注册 Service Worker 只需要在 HTML 页面的 `<script>` 标签中编写一段简短的 JavaScript 代码来完成。但是通过上一节对 AMP/MIP 的介绍，我们知道 AMP/MIP 页面是无法编写 JavaScript 的，那么在这种情况下，如何完成 Service Worker 的注册呢？

由于 MIP 可以通过 `<mip-script>` 标签来支持编写简单的 JavaScript 代码，虽然有一些限制，但是是可以编写 Service Worker 注册逻辑的，具体代码如下所示：

```html
<mip-script>
// 注册 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
</mip-script>
```

>注意：
>
> MIP 可以通过 `<mip-script>` 标签来支持编写简单的 JavaScript 代码，但是会有一些限制，具体可以参考 `<mip-script>` 组件文档（[https://www.mipengine.org/v2/components/extensions/mip-script.html](https://www.mipengine.org/v2/components/extensions/mip-script.html)），但是 AMP 并不支持编写自定义 JavaScript 的方式，所以这种方法不适合在 AMP 中使用。

MIP 还提供了一个组件 `<mip-install-serviceworker>` 来帮助 MIP 页面完成 Service Worker 的注册。具体用法很简单，首先只需要在 MIP 页面中引入 `<mip-install-serviceworker>` 组件的 JavaScript CDN 文件地址，如下代码所示：

```html
<script async src="https://c.mipcdn.com/static/v1/mip-install-serviceworker/mip-install-serviceworker.js"></script>
```

在引入组件 JavaScript 文件之后，在 MIP 页面中就可以使用 `<mip-install-serviceworker>` 标签在 MIP 页面中进行 Service Worker 的注册，如下代码所示：

```html
<mip-install-serviceworker src="./sw.js"
  data-iframe-src="https://mipexample.org/sw.html"
  layout="nodisplay"
  class="mip-hidden"
></mip-install-serviceworker>
```

在 mip-install-serviceworker 组件里，提供了 `src` 和 `data-iframe-src` 两个属性。如果要让 Service Worker 能顺利注册，两个属性都需要填写，因为 MIP 页不仅在搜索结果页下通过 iframe 的方式打开，还可以被直接访问。

如果是直接通过 MIP 页面的独立地址访问，因为 Service Worker 的文件 URL 域和当前 MIP 站点一致，可以直接注册，这个时候就会直接使用到 `src` 属性提供的 Service Worker 文件 URL，通过组件内部调用 `navigator.serviceWorker.register()` 方法进行直接注册。

但是 MIP 页不仅能直接访问，还能被缓存在 MIP Cache CDN 上，在搜索结果页通过 iframe 的方式打开，那么用户访问的这个页面的域名就不是站点本身的域名。由于站点不能跨域注册 Service Worker 文件 URL，所以不能无法通过 `navigator.serviceWorker.register()` 方法直接注册。这种情况下可以通过 iframe 嵌入和站点同一域的一个中间 HTML 页面来解决域名不同的问题，而在这个中间 HTML 页面中就可以注册 Service Worker，提前缓存站点资源，这个中间 HTML 页面的地址就是 data-iframe-src 属性指定的地址，HTML 页面代码可以很简单，如下代码所示：

```html
<!--https://same-origin-host-of-mip-page.com/index.html-->
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
</script>
```

虽然现代浏览器几乎都已经支持了 Service Worker，但是为了保证极致的体验和兼容性，mip-install-serviceworker 组件还提供了一种机制专门针对那些不支持 Service Worker 的浏览器。可以指定一个特殊的同源 shell 页面，在 MIP 页面中提前加载这个 shell 页面进行 HTTP 缓存。通过 `data-no-service-worker-fallback-url-match` 属性指定需要跳转到该 shell 页面的 URL 规则，该属性为正则表达式。并且可以通过 `data-no-service-worker-fallback-shell-url` 指定的 shell 页面的 URL, 需要和 MIP 页面保持同源，当该 shell 页面加载完成之后，有必须通过 hash 参数 redirect 到原页面的逻辑。代码如下所示：

```html
<mip-install-serviceworker src="./sw.js"
  data-iframe-src="https://mipexample.org/sw.html"
  layout="nodisplay"
  class="mip-hidden"
  data-no-service-worker-fallback-url-match=".*\.html"
  data-no-service-worker-fallback-shell-url="https://mipexample.org/shell/"
></mip-install-serviceworker>
<a data-type="mip" href="https://samehost.org/some/path/index.html">link1</><br/>
<a data-type="mip" href="http://samehost.org/some/path/index.html">link2</a><br/>
<a data-type="mip" href="https://diffhost.org/some/path/index.html">link3</a>
```

在不支持 Service Worker 的浏览器环境下，点击 link1，link2 链接同样可以实现离线缓存的效果，link3 由于不同源的问题，所以缓存不会生效。

当然，AMP 同样也提供了 `<amp-install-serviceworker>` 组件可以进行 Service Worker 注册的工作，用法和 `<mip-install-serviceworker>` 一致。

### 编写 Service Worker

在 MIP 页面中顺利完成 Service Worker 的注册之后，接下来的工作就是就是编写 Service Worker 文件的逻辑了。根据第四章的介绍，在 Service Worker 中监听 `fetch` 事件可以拦截在 Service Worker 作用域范围内的所有网络请求，下面代码展示了一个简单的 Service Worker 文件示例：

```js
const CACHE_NAME = 'my-mip-pwa-test'

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        let promise = fetch(event.request).then(res => {
          cache.put(event.request, res.clone())
          return res
        })

        // 可以在这里对 response 做进一步的处理
        return response || promise
      })
    })
  )
})
```

通过以上代码就可以完成简易网络请求的缓存功能了，实际上还不是很完善，没有做缓存的更新及清理，也没有预加载的逻辑，在第四章已经对如何开发一个完善的 Service Worker 文件有了详细的介绍，开发者完全可以根据自己的需求来编写 Service Worker 文件。
