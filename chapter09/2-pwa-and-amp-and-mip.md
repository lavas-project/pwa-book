# PWA 与 AMP/MIP

本节将会介绍 PWA 如何和 AMP/MIP 进行结合应用，以至于让 PWA 能够再搜索环境下体验变得更好。在看 PWA 如何和 AMP/MIP 结合之前，还是先了解一下什么是 AMP/MIP。

## 什么是 AMP/MIP

AMP（[https://www.ampproject.org](https://www.ampproject.org)）和 MIP（[https://www.mipengine.org](https://www.mipengine.org)）分别是 Google 和百度推出的网页加速的解决方案，主要面向移动端网页，因为 MIP 和 AMP 都是采用同样原理的解决方案，本章的内容都以介绍 AMP 为主。

AMP 的原理解释起来也很简单，总结起来，包括三个部分：AMP HTML 规范、AMP Cache、AMP JS 运行时。

### AMP HTML 规范

AMP 制订了非常严格的 HTML 编写规范，只有严格按照 AMP HTML 规范编写的 HTML 页面并通过 AMP 校验器的校验，才能享受到 Google 搜索结果页给 AMP 页面带来的优质用户体验。

下面的代码展示的是一个简单的 AMP HTML 的例子。

```html
<!doctype html>
<html amp lang="en">
  <head>
    <meta charset="utf-8">
    <script async src="https://cdn.ampproject.org/v0.js"></script>
    <title>Hello, AMPs</title>
    <link rel="canonical" href="http://example.ampproject.org/article-metadata.html">
    <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
    <style amp-boilerplate>
      /* default css */
    </style>
    <noscript>
      <style amp-boilerplate>
        body {
          -webkit-animation: none;
          -moz-animation: none;
          -ms-animation: none;
          animation: none
        }
      </style>
    </noscript>
  </head>
  <body>
    <h1>Welcome to the mobile web</h1>
    <amp-img src="welcome.jpg" alt="Welcome" height="400" width="800"></amp-img>
  </body>
</html>
```

在 AMP HTML 里可以使用很多标准自带的 HTML 标签，如 `<h1>`、`<div>` 等，但是也有很多标签不能使用，如 `<img>` 、`<iframe>` 等，因为这类型的原生的 HTML 标签对页面渲染性能有影响，如 `<img>` 加载的图片不经过 JS 无法 lazyload，对首屏性能有影响。

因此 AMP 采用 W3C 提出的 customElements 标准编写了一个 `<img>` 标签的替代品自定义标签 `<amp-img>`，默认支持 lazyload，类似的自定义标签还有很多，最终的目的只有一个：让 AMP 页面的性能最好、体验最佳。

下面是列举了几个比较重要的 AMP HTML 的规范，详细的规范请参照 AMP 的官方文档：[https://amp.dev/documentation/guides-and-tutorials/learn/spec/amphtml.html](https://amp.dev/documentation/guides-and-tutorials/learn/spec/amphtml.html)。

**MUST**

1. 必须要以 `<!doctype html>` 开始 HTML 页面。
2. `<html>` 必须包含雷电标属性或者 amp，如 `<html ⚡>` 或 `<html amp>`。
3. 必须要包含 `<head>` 和 `<body>` 标签。
4. 在 `<head>` 里必须要有一个 canonical link 标签，指向常规的非 AMP 版本的 HTML 页面，如：`<link rel="canonical" href="$SOME_URL">`。
5. charset 必须指定为 `UTF-8`，如 `<meta charset="utf-8">`
6. 必须包含一个 viewport meta 标签，如：`<meta name="viewport" content="width=device-width">`。
7. 引入 AMP 官方指定的 AMP JS 运行时：`https://cdn.ampproject.org/v0.js`
8. 必须包含 boilerplate 相关样式

**MUST NOT**

1. 不能在 `<script>` 标签中编写 JavaScript 代码，不能外链 JavaScript 代码，除了 AMP 的代码外。
2. 不能通过 `<link>` 加载外链 style 资源，CSS 必须写在 `<style amp-custom><style>` 中，且不超过 50KB。
3. 不允许使用 `<img>`, `<video>`, `<audio>`, `<iframe>` 等标签。

#### AMP Cache

AMP Cache 是 Google 的一个基于代理的 CDN，几乎所有的 Google 搜索结果页的 AMP 页面的资源都从这个 CDN 分发。AMP Cache 的工作流程非常好理解，流程示意图如图 9-1 所示。

![图 9-1 搜索引擎收录 AMP 流程](./img/amp_search_engine_process.png)

图 9-1 的描述信息基本上可以描述为以下几个步骤：

1. 开发者提供 AMP HTML 页面的 URL 让 Google 搜索引擎爬虫抓取。
2. 当开发者编写的 AMP HTML 页面被 Google 搜索引擎爬虫抓取，首先通过 `<html>` 是否含有 `amp` 属性判断是否是一个 AMP 页面。
3. 如果判断结果是一个 AMP 页面就会启动 AMP Server 服务。
4. AMP Server 服务会运行 AMP Validator 来校验当前的 HTML 页面是否完全符合 AMP HTML 的规范，如果校验符合规范，则被认定为标准的 AMP HTML 页面。
5. AMP Server 会抓取这个 AMP HTML 以及 AMP HTML 依赖的所有静态资源。
6. AMP Server 将这些静态页面和静态资源全部存储在 AMP Cache，并改写 AMP HTML 的引用静态资源的路径。
7. 当用户在 Google 搜索引擎的搜索结果页点击 AMP 的结果时，Google 会在搜索结果页创建一个 iframe，以异步的方式打开存储在 AMP Cache CDN 的 AMP HTML 页面，而且该页面所有的静态资源就都是从 AMP Cache CDN 加载来的。

也就是说 AMP 通过这种 Cache 存储全部静态资源的方式彻底的保证了加载性能。同时 AMP Cache 支持 HTTP2 协议，并且非常稳定，通过这种集中式的极致性能优化将加载速度提升，能够有效保证页面的稳定性和速度。

#### AMP JS 运行时

AMP JS 运行时指的是 `https://cdn.ampproject.org/v0.js`，也经常被称之为 `amp.js`，`amp.js` 同样也是部署在 AMP Cache CDN 上的，AMP 封装了一系列的 AMP 自定义标签，这些自定义标签既提供了完善的功能，又充分的规避了性能问题，在用户体验上下足了功夫，而这些 AMP 自定义标签也需要依赖于 `amp.js` 才能正常执行。

AMP JS 运行时实现了所有 AMP **最佳性能原则**（[https://www.ampproject.org/learn/about-how](https://www.ampproject.org/learn/about-how))，AMP JS 运行时还提供了资源加载的管理机制，确保页面能够快速渲染，并异步加载所有资源，当然 AMP JS 运行时不仅确保所有的资源能够异步加载，而且还能够在资源加载之前预先计算每个元素的布局，加快首屏展现的速度。当然 AMP JS 运行时提供的功能远比这些复杂的多，AMP 可查阅的资料较多，在本章就不做深入的讲解。

### PWA 结合 AMP/MIP

了解了 AMP 和 MIP 的基本原理后，我们已经知道了在移动端 AMP/MIP 是一种行之有效的提升搜索引擎搜索结果落地页性能的方案。但与此同时，我们也看到了 AMP/MIP 的诸多局限性，在规范上限制很多，不能编写 JavaScript 代码，这样对于要实现一个复杂交互的 Web App 来说，无疑是增加了开发和维护成本，甚至可能由于 AMP 自定义标签的功能支持不足以满足业务需求时，会显得束手无策。

因此 Google 也给出了一些建议，他们建议资讯类的 Web App 或交互较少的 Web App 适合用 AMP 来编写，如新闻、博客、相册等应用。而通过前面章节对 PWA 的了解，我们可以知道 PWA 往往比较复杂，能够支撑复杂的交互和复杂的业务逻辑。基于这些背景，我们需要探索出一条路，让用户从搜索结果页到落地页站点都具有比较完美的体验。这就需要考虑将 AMP/MIP 和 PWA 进行结合一下。经过一些实际项目的探索，目前比较合适的方案有两种。

第一种方案是将整个站点都用 AMP 方式来编写，也可以称之为**全站 AMP**，在 AMP 页面的基础上再增加 Web App Manifest 和 Service Worker 的支持，就能够实现一个 AMP + PWA 模式的站点了。这种方案的好处由于搜索落地页还是 AMP 页面，所以从搜索结果页跳转的落地页体验会非常好，当落地页打开之后，后面再进行交互，由于集成了 Web App Manifest 和 Service Worker，搜索落地页也可以直接具有添加到桌面和离线缓存的功能。但是这种方案局限于 AMP 不能够支持复杂的站点，导致不太适合做复杂交互的 Web App。

第二种方案就是将 AMP/MIP 页面作为中间页面，也可以称之为**在 AMP 中预加载 PWA**，可以将 AMP 页面的 HTML 中的 `<link rel="canonical">` 标签的 `href` 指向 PWA 站点 URL，并且类似于 SSR 的方式提供一份 AMP 的页面内容以供搜索引擎抓取，如下代码所示：

```html
<!--...-->
<link rel="canonical" href="https://pwa.host/some/path">
<!--...-->
```

在搜索结果页点击 AMP 结果进入搜索落地 AMP 页后，点击 AMP 页面里的链接再跳转到 PWA 相应的页面，这样设计的的好处是在搜索结果页点出的体验非常良好，并且又能实现复杂交互的 PWA。

除此之外，AMP 还提供了 PWA 内嵌 AMP 页面的能力，可以将 AMP 页面作为 PWA 的数据源，详细的可以参考 《Embed & use AMP as a data source》[https://www.ampproject.org/docs/integration/pwa-amp/amp-in-pwa](https://www.ampproject.org/docs/integration/pwa-amp/amp-in-pwa)，篇幅有限，本章将不会对这种方法进行深入讲解。本章接下来的内容将重点介绍前面提到的两种方案，将会深入的介绍具体做法以及遇到的一些问题。
