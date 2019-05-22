# 在 AMP/MIP 页面中预加载 PWA

通过本章第二节，我们了解到 AMP/MIP 不适合用实现复杂的 Web App，按照 AMP 官网的介绍，AMP 是“叶子页面”（有具体内容，不是导航类型的页面）理想的解决方案，因为它加载快，体验好，适合做搜索引擎跳出的第一个页面，却由于无法编写 JavaScript，不适合完成复杂的需求。因此第二跳应该从 AMP 跳出到 PWA，但是大部分 PWA 站点由于其重度依赖于 JavaScript，导致首屏较慢，那么这节就来解释一下如何通过在 AMP/MIP 中预加载 PWA 页面来加速 PWA 页面的展现。

接下来先开门见山的介绍一下整个方案的步骤。

1. 将所有的叶子页面都做成 AMP/MIP，通过 `canonical` 指向 PWA 对应的页面。
2. 在 AMP 页面中嵌入 `<mip-install-serviceworker>` 来提前注册 Service Worker。
3. Service Worker 在注册和安装的时候把 PWA 页面依赖的文件缓存好，包括 App Shell 依赖的所有资源。
4. AMP 页面中所有链接都跳到 PWA。
5. 当用户点击 AMP 中的链接，请求会被 Service Worker 拦截，会立即展现 App Shell。

## 在 AMP/MIP 页面中注册站点的 Service Worker

和上节一样步骤基本一样，首先通过在 MIP 页面中嵌入 `<mip-install-serviceworker>` 来注册 Service Worker。

```html
<!-- 引入 mip-install-serviceworker 的扩展的 JS -->
<script async src="https://c.mipcdn.com/static/v1/mip-install-serviceworker/mip-install-serviceworker.js"></script>

<!-- 注册 Service Worker -->
<mip-install-serviceworker
  src="https://www.your-domain.com/serviceworker.js"
  layout="nodisplay">
</mip-install-serviceworker>
```

## 编写 Service Worker 的逻辑

与上节不同的是，在这种方案里需要对将要跳转的 PWA 页面的 App Shell 等文件进行预缓存，从而提升跳转首屏展现的用户体验，因此代码编写上会有一些区别，下面代码所展示的是一个 AMP/MIP 跳转的 PWA 的 Service Worker 文件的一部分内容，主要是对 App Shell 先进行预缓存。

```js
const CACHE_NAME = 'my-site-precache'
const URLS_TO_CACHE = [
  '/',
  '/static/vendor.js',
  '/static/app.js',
  '/static/app.css'
]
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 将列表中的文件进行预缓存
      return cache.addAll(URLS_TO_CACHE)
    })
  )
})
```

上面的例子其中一部分，`/` 就是 App Shell，其他都是其依赖的静态文件，如果采用 SSR，那么 Service Worker 就还需要再进行加工，在前面的章节中也有过介绍。

到这里注册 Service Worker 和编写 Service Worker 都已经完成了，开发者只需要再将 AMP/MIP 中的链接跳转到对应的 PWA 页面即可。

以上就是第九章的全部内容，讲解了 PWA 与搜索如何结合，如何使用 AMP/MIP 来对页面进行加速。
