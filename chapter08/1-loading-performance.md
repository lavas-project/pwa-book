# 加载性能

Web 页面由 HTML、CSS、JavaScript 和其他多媒体资源组成。页面加载时，必须从服务器获取这些资源。在这一节中，我们会围绕这些资源和网络请求，讨论如何优化页面加载性能。

## 减小资源体积

为了让页面更快加载，最容易想到的是减小资源体积。页面中最常见的资源有 HTML、CSS、JavaScript 等文本资源，以及字体、图像、音视频等多媒体资源。

### 压缩文本内容

压缩文本资源，就是在不改变资源有效性的情况下，通过删除多余空格、变量名替换、表达式改写等操作，来尽可能减小文本资源的体积。

压缩虽然简单，但十分有效，这也是最广泛的优化资源体积的操作。许多工具可以帮助我们完成文本压缩。目前主流的资源打包工具 webpack，生态较为繁荣，通过 loader 和 plugin 机制集成了多种常用的资源处理库。如 `TerserPlugin` 可以用于压缩 JavaScript，`PostCSS` 可以对 CSS 进行压缩，以及完成前缀自动补全工作。关于 webpack 的更多介绍，详见下文 [使用 webpack 优化资源加载](#使用-webpack-优化资源加载)。

除了压缩单个文件外，在服务器上配置 Gzip 也十分重要。Gzip 对文本资源的压缩效果非常明显，通常可以将体积再压缩至原本的 30% 左右，但 Gzip 对已经单独压缩的图像等非文本资源来说，效果并不好。Apache、Nginx 等服务器都提供了 Gzip 功能，可以分别在配置文件 `.htaccess`、`nginx.conf` 中进行相应的配置。开启 Gzip 后，资源文件的 HTTP 响应头部中， `Content-Encoding` 也会变为 `gzip`。

### 优化 JavaScript 第三方库引入

在现代 Web 单页应用中，JavaScript 往往成为了最重要的文本资源。除了用于页面渲染的 JavaScript 框架外，还有许多工具库被广泛引用，如 lodash、underscore，甚至 jquery 等。

不计后果地引入第三方库，会迅速增大 JavaScript 资源的体积。如果我们只需要使用工具库中少数几个简单函数，可以考虑使用原生 JavaScript 代替。

实际上，由于现代前端框架大幅普及，以及浏览器兼容性问题日益减少，我们对 jQuery 的依赖已经不像过去那样强了。在《You Don't Need jQuery》（[https://github.com/nefe/You-Dont-Need-jQuery](https://github.com/nefe/You-Dont-Need-jQuery)）一文中，就详细地描述了如何使用原生 JavaScript 代替 jQuery。

同时，随着 ES6 及后续标准的持续改进，原生 JavaScript 能力被大大增强了。我们可以从《You don't (may not) need Lodash/Underscore》（[https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore](https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore)）一文中，了解到如何使用现代 JavaScript 实现常用的工具函数。

不过，在实际项目中，lodash 等工具库往往十分有用。lodash 不仅包含了许多常用的函数，而且每个函数都有相当丰富的单元测试，代码质量很高。需要注意的是，我们在引入 lodash 时，应该仅引入所需的函数，而不是将整个库全部引入进来。类似的，如 moment 等一些较为庞大的第三方库，也需要在引入时进行体积优化。具体的实践详见下文 [使用 webpack 优化资源加载](#使用-webpack-优化资源加载)。

## 对资源进行缓存

除了对资源文本大小进行优化外，还可以从缓存的角度进行考虑。缓存无处不在，往往能大幅加快响应速度，从而在优化页面加载性能的工作中有举足轻重的作用。在上文中已经介绍过 Cache Storage 和 IndexedDB 等缓存技术，这一节主要关注 HTTP 缓存。

### HTTP 缓存

现代浏览器都实现了 HTTP 缓存机制。浏览器在初次获取资源后，会根据 HTTP 响应头部的 `Cache-Control` 和 `ETag` 字段，来决定该资源的缓存策略。

`Cache-Control` 有多个可能的字段值：

- `no-store`：表明任何缓存不得存储该资源，每次请求都会从服务端返回完整的内容。
- `no-cache`：表明必须向服务端发一次请求，该请求头部带有 `If-None-Match` 等资源校验信息。服务端将会验证该资源是否被修改过，详细见下文 `ETag` 的描述。
- `public`：表明该资源可以被 CDN 或代理等中间人缓存。
- `private`：与 `public` 相反，表明任何中间人不得缓存该资源，资源可能与隐私信息相关。
- `max-age`：指定了资源缓存的过期时间（秒），仅当缓存过期后才会向服务端发送请求。

`ETag` 是由服务端决定的一个资源校验字段。如果浏览器缓存已经过期，那么会向服务端询问该资源是否被修改过。服务端会将 HTTP 请求头部的 `If-None-Match` 与 `ETag` 进行比对。如果相等，则表明资源并没有被修改过，服务端返回 `304 Not Modified`，浏览器可以直接从缓存获取资源，并刷新缓存过期时间。否则就需要返回该资源的完整内容。

为了达到最佳缓存效果，常用的做法是：

- 对于 HTML 文件，设置 `Cache-Control: no-cache`。
- 对于 CSS 和 JavaScript 等静态资源，上线构建的时候在文件名中插入一段仅与文件内容相关的哈希值，并使用 `Cache-Control: max-age=31536000` 进行长缓存。

这样的效果是，对于绝大多数静态资源的请求都可以使用缓存来响应，并且仅在文件内容变更时刷新缓存。具体的实践详见下文 [使用 webpack 优化资源加载](#使用-webpack-优化资源加载)。

## 调整资源优先级

页面加载时，浏览器会对各种类型的资源分配默认优先级。一般来说，CSS 会被分配最高优先级，JavaScript 会被分配高优先级，而图像则被分配了低优先级，等等。虽然并不能真正修改这些优先级，但我们仍能通过预加载、懒加载等多种方式，调整资源加载的行为，优化网页加载性能。

### 预加载

 `<link rel="preload">` 是一种通用的预加载方式，支持几乎所有常用资源类型。我们可以在 `<head>` 中，通过 `<link rel="preload">` 来提前声明当前页面所需的资源，以便浏览器能预加载这些资源。一个实际的预加载例子如下：

```html
<!DOCTYPE HTML>
<html>
<head>
  <!-- ... -->
  <link rel="preload" as="style" href="/dist/index.css">
  <link rel="preload" as="script" href="/dist/vendor.js">
  <link rel="preload" as="script" href="/dist/app.js">
  <link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/dist/fontawesome.woff2">
  <link rel="preload" as="image" href="/dist/banner-narrow.png" media="(max-width: 960px)">
  <link rel="preload" as="image" href="/dist/banner-wide.png" media="(min-width: 961px)">
  <link rel="stylesheet" href="/dist/index.css">
  <!-- ... -->
</head>
<body>
  <!-- ... -->
  <script src="/dist/vendor.js"></script>
  <script src="/dist/app.js"></script>
</body>
</html>
```

上述例子中，预加载了 CSS、JavaScript、图像和字体文件。 `as` 属性表明了资源的类型，从而浏览器才会为后续的 `<link rel="stylesheet">` 、`<script>` 和 CSS 文件中的 `url()` 声明使用预加载的资源，而不是再发起一次请求。另外，还可以通过 `media` 属性进行媒体查询，根据响应式的情况选择性地预加载资源。

### 预连接与 DNS 预解析

如果不希望对资源进行预加载，那么也可以考虑使用 `<link rel="preconnect">`，提前与资源建立 socket 连接。预连接会提前完成 DNS 解析、TCP 握手和 TLS 协商的工作，但并不会提前加载资源，用法如下代码所示。

```html
<link rel="preconnect" crossorigin="anonymous" href="https://use.fontawesome.com">
```

DNS 预解析与预连接类似，通过 `<link rel="dns-prefetch">` 声明，但仅会提前进行 DNS 解析。

### 预取

预取通过 `<link rel="prefetch">` 声明，通常用于提前加载用户接下来可能需要的资源，如点击“下一页”的页面等。浏览器会在空闲时，使用最低优先级下载预取的资源，用法如下代码所示。

```html
<link rel="prefetch" href="/next-page.html">
```

浏览器并不会递归地进行预取。如上述例子中，`next-page.html` 需要预取的资源，并不会在当前页面提前下载。

### 懒加载

可以对图像资源采用“懒加载”策略，即仅加载当前在视口内的图像，而对于视口外未加载的图像，在其即将滚动进入视口时才开始加载。

`IntersectionObserver` 可以帮助我们高效地判断元素是否进入视口。一个简单的图像懒加载功能实现如下：

```js
document.addEventListener('DOMContentLoaded', () => {
  const images = [...document.querySelectorAll('img')]
  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return
      }

      const image = entry.target

      image.src = image.dataset.src
      image.srcset = image.dataset.srcset
      observer.unobserve(image)
    })
  })

  images.forEach(image => observer.observe(image))
})
```

但 `IntersectionObserver` 的浏览器兼容性目前并不太好，可按需引入相应的 polyfill 进行兼容。当然，也可以使用较传统的方法，监听图像元素的 `scroll`、`resize`、`orientationchange` 事件，通过 `getBoundingClient()` 来判断元素是否在视口内，从而实现懒加载。

```js
import {throttle} from 'lodash'

document.addEventListener('DOMContentLoaded', () => {
  let images = [...document.querySelectorAll('img')]
  const lazyLoad = throttle(() => {
    images = images.filter((image) => {
      const imageRect = image.getBoundingClientRect()

      if (imageRect.top >= innerHeight || imageRect.bottom < 0 || getComputedStyle(image).display == 'none') {
        return true
      }

      image.src = image.dataset.src
      image.srcset = image.dataset.srcset
      return false
    })

    if (images.length == 0) {
      document.removeEventListener('scroll', lazyLoad)
      window.removeEventListener('resize', lazyLoad)
      window.removeEventListener('orientationchange', lazyLoad)
    }
  }, 200)

  document.addEventListener('scroll', lazyLoad)
  window.addEventListener('resize', lazyLoad)
  window.addEventListener('orientationchange', lazyLoad)
})
```

需要注意的是，我们还应该根据图像加载后的大小，设置图像占位符。这样可以避免图像加载后触发页面重新布局，造成页面闪烁。关于页面布局的详细内容，在后面章节的[渲染性能](./2-rendering-performance.md)的内容里会详细介绍。

对于视频同样可以采用懒加载策略。与图像懒加载的差别是，占位符使用 `<video>` 的 `poster` 属性实现，以及需要遍历子 `<source>` 元素将 `data-src` 修改为 `src` 。由于原理十分类似，这里不再重复展开。

## 使用 webpack 优化资源加载

webpack 是现代 Web 应用最常用的资源打包工具。接下来会以 webpack 4 为例，简单介绍一下如何使用 webpack 实现上文提到的各种优化手段。对于其他版本的 webpack，仅在具体配置上可能会有所出入，而背后的原理都是相同的。

### 区分开发环境和生产环境

设置 node 环境变量 `NODE_ENV` 可以用来区分开发环境和生产环境，一般用 `development` 表示开发环境，而 `production` 则表示生产环境。设置后，我们就可以在项目的构建脚本中，通过 `process.env.NODE_ENV` 获取当前环境，根据环境进行 webpack 的差异化配置了。

通常会使用 cross-env 库提供的 `cross-env` 命令来设置环境变量，这样做是为了兼容 Windows 系统。

```shell
cross-env NODE_ENV=production webpack
```

同时，需要将 webpack 配置中的 `mode` 选项设置为对应的环境。webpack 会根据不同环境，进行一些默认的配置，如 `mode` 为 `production` 时，会将 `optimization.minimize` 设置为 `true`，表明 webpack 将会使用 `TerserPlugin` 插件压缩 JavaScript 构建产物。关于不同 `mode` 配置下的详细效果，可参考官方文档。

```js
// webpack.config.js
module.exports = {
  mode: 'production' // 或 'development'
}
```

设置 `mode` 后，项目中就可以根据不同环境编写代码了，如仅在开发环境下才输出的日志等。这是由于 webpack 会使用内置的 `DefinePlugin` 插件将项目源代码中出现的所有 `process.env.NODE_ENV` 直接替换为 `mode` 对应的环境。

```js
if (process.env.NODE_ENV === 'development') {
  console.log('This app is in development mode.')
}
```

上述代码，在生产环境下会被编译为：

```js
if ('production' === 'development') {
  console.log('This app is in development mode.')
}
```

这个分支的判断条件始终为 `false`。从而，在 webpack 生产环境下默认开启使用的 `TerserPlugin` 插件，会将这段代码完全删除。我们在构建产物中将看不到整个 `if` 语句块了。

### Tree shaking

历史上，JavaScript 有过多种模块化标准，如 CommonJS、AMD 和 ES modules。我们在实际项目中使用的第三方库，通常会提供通过 CommonJS 和 ES modules 导出的两个版本。一个典型的 `package.json` 文件，包含 `main` 和 `module` 两个字段，分别是通过两种模块化标准导出的文件入口。webpack 优先会读取 `module` 字段表明的文件入口。当 `module` 不存在时，才会从 `main` 中导入。

```json
{
  // ...
  "main": "lib/index.js",
  "module": "es/index.js",
  // ...
}
```

由于 CommonJS 标准允许在代码中动态导入其他模块，从而无法准确分析哪些模块被导入了。但 ES modules 标准的模块导入是静态的，使得模块间依赖可以通过静态分析来更好地优化了。关于 ES modules 标准新增的动态导入特性 `import()`，会在后面的[合理拆分代码](#合理拆分代码)章节中详细介绍，下面先来看一个简单的示例，假设现在有两个文件 `math.js` 和 `index.js`，它们的内容分别如下所示：

```js
// math.js
export const add = (a, b) => a + b

export const mul = (a, b) => a * b
```

```js
// index.js
import {add} from './math'

console.log(add(1, 2))
```

上述代码中，`mul` 函数将不会出现在构建产物中。这种优化技术被形象地称作 Tree shaking（摇树）。`mul` 函数就像树上枯萎的叶子一样，摇树后自然就掉下来了。

在实际项目中，为了浏览器兼容性考虑，我们通常会使用 Babel 等编译器来编译现代 JavaScript 代码。为了启用 Tree shaking，应该确保编译器不将 ES modules 语法编译到其他模块化标准。

部分常用的第三方库无法使用 Tree shaking，通常需要使用专门的工具进行处理。如 `babel-plugin-lodash` 会对引入了 `lodash` 的文件进行额外处理。

```js
// 处理前
import _ from 'lodash'
import { add } from 'lodash/fp'

const addOne = add(1)
_.map([1, 2, 3], addOne)
```

```js
// 处理后
import _add from 'lodash/fp/add'
import _map from 'lodash/map'

const addOne = _add(1)
_map([1, 2, 3], addOne)
```

容易看出，不经过处理的文件会引入整个 lodash 库，这不是我们想要的结果。而经过 babel-plugin-lodash 处理后，则仅会引入我们所需的两个函数，大大减小了打包后的代码体积。

对于另一个体积较大的第三方库 moment 来说，使用 `ContextReplacementPlugin` 可以仅引入我们所需的本地化语言，而不是将所有语言都打包进来。

```js
// webpack.config.js
const {ContextReplacementPlugin} = require('webpack')

module.exports = {
  // ...
  plugins: [
    new ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn/)
  ]
}
```

### 启用长期缓存

webpack 在生成打包文件时，可以在文件名中插入一段仅与文件内容相关的哈希值。仅当该文件更新后，缓存才会失效，这样可以充分利用 HTTP 缓存。

配合 html-webpack-plugin 插件可以很方便地将生成的打包文件路径插入 HTML 中。

注意到 webpack 自身有一些运行时的代码，容易破坏缓存有效性，我们应该将这些代码单独打包。进一步的，可以将打包后的 webpack 运行时代码直接插入 HTML 中，以节省一次 HTTP 请求。

打包文件中模块的相互引用，都是通过 webpack 赋予的 id 来查找的，默认为自增的计数器。当新增或删除某些模块时，对应的 id 很可能会发生改变，这样就破坏了长期缓存。同样道理，我们应该使用稳定的哈希值作为模块的 id。

```js
// webpack.config.js
const {HashedModuleIdsPlugin} = require('webpack')
const HtmlPlugin = require('html-webpack-plugin')
const InlineManifestPlugin = require('inline-manifest-webpack-plugin')

module.exports = {
  output: {
    filename: '[name].[chunkhash].js'
  },
  optimization: {
    runtimeChunk: 'single'
  },
  plugins: [
    new HashedModuleIdsPlugin(),
    new HtmlPlugin(),
    new InlineManifestPlugin()
  ]
}
```

### 合理拆分代码

我们往往不需要在首屏一次性加载所有 JavaScript 代码。为了加快首屏展现的速度，可以将当前暂时不需要的代码拆分出去。webpack 支持根据 `import()` 方法的调用处，把异步加载的模块拆成一个独立的 JavaScript 分片。

假设现在有一个首屏渲染用不到的 `huge-component.js` 模块，其代码如下所示：

```js
// huge-component.js
export default HugeComponent = () => /* ... */
```

在首页引入的 `index.js` 模块中，为了不默认将 `huge-component.js` 模块引入进来打包成一个大的产物，可以借助 `import()` 方法将 `huge-component.js` 模块拆分出去，如下代码所示：

```js
// index.js
if (/* ... */) {
  import('./huge-component').then(({default: HugeComponent}) => /* ... */)
}
```

上述例子通过 webpack 打包后，会将 `huge-component.js` 作为一个打包新入口，拆成一个独立的 JavaScript 文件。仅在 `if` 语句块内执行 `import()` 时，才会对该分片 JavaScript 资源发送异步请求。

合理拆分代码，不仅能显著提升首屏加载性能，还能获得更好的缓存效果。当仅修改少数几个分片的代码时，其他分片的缓存仍然有效。

### 压缩文本内容

JavaScript 在生产环境下默认开启压缩，无需额外配置。这里以 CSS 为例，在 webpack 中使用 postcss-loader，利用 PostCSS 的插件 cssnano 可以完成 CSS 的压缩，并且可以额外使用 autoprefixer 完成补全属性前缀的任务。postcss-loader 对应的 `postcss.config.js` 配置文件如下：

```js
// postcss.config.js
module.exports = {
  plugins: {
    autoprefixer: {},
    cssnano: {
      preset: [
        'default', {
          discardComments: {
            removeAll: true
          }
        }
      ],
      zindex: false,
      reduceIdents: false
    }
 }
}
```

对于其他资源，也会有对应的 loader 或 plugin 来完成压缩任务，这里不再一一列举。

### 分析资源体积

webpack-bundle-analyzer 是一个关于 webpack 构建产物的可视化插件，可以清晰地看到构建产物的体积，以及这些产物分别包含了哪些模块。我们能得知对于资源体积的优化是否生效，并分析出后续的优化方向。也能轻易监控出是否意外引入了不必要的库，增大了构建产物的体积。

```js
// webpack.config.js
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer')

module.exports = {
  // ...
  plugins: [
    new BundleAnalyzerPlugin()
  ]
}
```
