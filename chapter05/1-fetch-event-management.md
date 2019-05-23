# 资源请求的拦截代理

对资源请求的拦截代理是 Service Worker 的重要功能之一。Service Worker 在完成注册并激活之后，对 `fetch` 事件的监听就会开始生效，我们可以在事件回调里完成对请求的拦截与改写。下面这个简单的例子演示了如何拦截 `http://127.0.0.1:8080/data.txt` 的资源请求，并返回固定请求响应的过程：

```js
self.addEventListener('fetch', function (event) {
  if (event.request.url === 'http://127.0.0.1:8080/data.txt') {
    event.respondWith(new Response('Hello World!'))
  }
})
```

这样无论原始的 data.txt 内容是什么，经过上面的 Service Worker 拦截改写之后，都将变成简单的“Hello World!”。基于同样的方法，我们能够对任何形式的资源请求进行拦截代理，包括各种 JS、CSS、HTML 等文本文件，各类接口请求，甚至是图片、视频等数据流都是可以的。

## 资源请求的判断

`fetch` 事件会拦截页面上所有的网络资源请求，但我们通常只对部分资源请求进行处理，其余的请求会继续走浏览器默认的资源请求流程。因此需要对当前的资源请求进行判断分类。

`fetch` 事件回调参数的 `event.request` 属性描述了当前被拦截的资源请求，可以通过它来进行判断分类。event.request 是 Request 对象的实例，包含了资源请求的 URL、请求模式、请求头等全部信息。

一般情况下，资源请求的判断可以通过对 event.request.url 进行匹配来实现。下面的示例代码展示出部分常用的匹配方法：

```js
// 全等匹配
if (event.request.url === 'http://127.0.0.1:8080/data.txt') {
  // 匹配成功
}

// 正则匹配
if (/\/data\.txt/.test(event.request.url)) {
  // 匹配成功
}

// 借助 URL 进行匹配
let url = new URL(event.request.url)
if (
  url.hostname === '127.0.0.1' &&
  url.port === '8080' &&
  url.pathname === '/data.txt'
) {
  // 匹配成功
}
```

在一些特殊情况下，仅靠 URL 进行文本匹配并不足以判断资源请求是否满足，那么可以利用 event.request 的其他属性进行辅助判断：

```js
// 匹配 POST 请求
if (event.request.method === 'POST') {
  // 匹配成功
}

// 匹配 text/html 资源类型请求
if (event.request.headers.get('Content-Type') === 'text/html') {
  // 匹配成功
}
```

我们可以将前面提到的一些常用的匹配方法封装成 `match` 函数，在后续使用的时候，只需要传入匹配规则和资源请求对象即可：

```js
function match (rule, request) {
  switch (Object.prototype.toString.call(rule)) {
    // url 文本匹配
    case '[object String]':
      // 使用 URL() 将匹配规则传入的路径补全
      return request.url === new URL(rule, location).href

    // url 正则匹配
    case '[object RegExp]':
      return request.url.match(rule)

    // 支持自定义匹配
    case '[object Function]':
      return rule(request)
  }
}
```

下面举一些使用 match 方法进行资源请求匹配的例子：

```js
// 完整版 URL 匹配
match('http://127.0.0.1:8080/data.txt', event.request)

// 相对路径 URL 匹配
//
// 假设当前页面网址为 http://127.0.0.1:8080/index.html
// 那么 /data.txt 会自动补全为 http://127.0.0.1:8080/data.txt
match('/data.txt', event.request)

// 正则匹配
match(/\/data\.txt/, event.request)

// 自定义匹配方法
match(
  request => request.url.indexOf('/data.txt') > 0,
  event.request
)
```

## 资源请求的响应

通过 `fetch` 事件回调参数的方法 `event.respondWith(r)` 可以指定资源请求的响应结果。respondWith(r) 方法的参数 r 可以是一个 Response 对象实例，也可以是一个 Promise 对象，这个 Promise 对象在异步执行完成的时候同样需要 resolve 返回一个 Response 对象实例作为请求的响应结果。下面演示的两种请求响应方式都是可行的：

```js
// 直接返回 Response 对象
event.respondWith(new Response('Hello World!'))

// 等待 1 秒钟之后异步返回 Response 对象
event.respondWith(new Promise(resolve => {
  setTimeout(() => {
    resolve(new Response('Hello World!'))
  }, 1000)
}))
```

### 异步资源请求响应的正确方式

event.respondWith 方法与 `install`、`activate` 事件回调参数中的 event.waitUntil 类似，起到了扩展延长 `fetch` 事件生命周期的作用，在 `fetch` 事件回调同步执行完毕之前如果没有调用 event.respondWith(r) 指定资源响应结果，那么就会进入浏览器默认的资源请求流程当中。下面所演示一种常见的错误用法，此时 event.respondWith 是没有任何效果的。

```js
// 错误用法
self.addEventListener('fetch', event => {
  if (event.request.url === 'http://127.0.0.1:8080/data.txt') {
    setTimeout(() => {
      event.respondWith(new Response('Hello World!'))
    }, 1000)
  }
})
```

上面的错误用法当中，原本目的是 1 秒钟之后返回 Response 对象，但由于回调函数同步执行完毕之前没有检测到 event.respondWith(r) 方法的调用，因此在 setTimeout 执行回调之前，浏览器就已经发起网络请求并获取到真实的 data.txt，因此它的响应结果并不是被 Service Worker 改写的“Hello World!”。正确的做法是，应该将异步处理的操作包装成一个 Promise 对象传入 event.respondWith 方法中。

```js
// 正确用法

// 等待 1 秒钟之后异步返回 Response 对象
event.respondWith(new Promise(resolve => {
  setTimeout(() => {
    resolve(new Response('Hello World!'))
  }, 1000)
}))
```

### 资源请求响应的错误处理

需要注意的是，当使用了 event.respondWith 指定资源响应之后，无论是以同步还是异步的方式，最终都需要返回 Response 对象。假如返回的不是 Response 对象，或者是过程中存在任何未处理的错误，除了会导致对应的请求失败之外，控制台还会打印出 Service Worker 的程序错误信息。下面举例说明一些常见的错误，并指出其中错误的原因：

```js
// 错误原因：promise 返回结果非 Response 对象
event.respondWith('Hello World!')
event.respondWith(Promise.resolve())
event.respondWith(Promise.resolve('Hello World!'))

// 错误原因：存在未处理的异步错误
event.respondWith(Promise.reject(new Response('Hello World!')))
```

因此在调用 event.respondWith 的时候，需要主动捕获并处理错误、处理异常返回结果。我们可以封装一个 respond 方法来处理响应的各种异常，处理异常的方式我们在这里选择一种比较简单的方式，那就是直接返回一个状态为 500 的 Response 对象：

```js
function respond (event, handler) {
  try {
    // 执行响应处理方法，根据返回结果进行兜底
    let res = handler(event.request)
    // 异步的响应结果兜底
    if (res instanceof Promise) {
      let promise = res.then(response => {
          // 如果返回结果非 Response 对象，抛出错误
          if (!(response instanceof Response)) {
            throw Error('返回结果异常')
          }
          return response
        })
        // 异步响应错误处理，即直接返回状态码为 500 Response 对象
        .catch(() => new Response('Service Worker 出错', {status: 500}))

      event.respondWith(promise)
      return
    }

    // 同步响应如果出现任何错误
    // 可以选择不调用 event.respondWith(r)
    // 让资源请求继续走浏览器默认的请求流程

    if (res instanceof Response) {
      event.respondWith(res)
    }
  } catch (e) {}
}
```

这样，前面提到的各类异常响应就不会导致控制台报错了：

```js
// 继续走浏览器默认的请求流程
respond(event, () => 'Hello World!')
respond(event, () => {throw Error('出现异常')})

// 返回 500 Response 对象
respond(event, () => Promise.resolve())
respond(event, () => Promise.reject())

// 正常返回 'Hello World!'
respond(event, () => new Response('Hello World!'))
respond(event, () => Promise.resolve(new Response('Hello World!')))
```

这里展示的返回 500 只是其中一种处理方式，读者可以尝试改写成默认发起 fetch() 请求进行兜底。

## 资源请求与响应操作的管理

在 `fetch` 事件回调当中主要进行着资源请求匹配和响应结果返回的操作，可以把这个过程当做一个路由分发的问题，因此我们可以封装一个 Router 类来实现对路由的匹配规则和操作分发的统一管理。

```js
class Router {
  constructor () {
    // 存放路由规则
    this.routes = []
    // 注册 fetch 事件拦截
    this.initProxy()
  }

  initProxy () {
    self.addEventListener('fetch', event => {
      // 当拦截到资源请求时，会遍历已注册的路由规则，并执行相应规则所对应的策略
      for (let route of this.routes) {
        // 使用前面封装好的 match 函数进行路由规则匹配
        if (match(route.rule, event.request)) {
          // 使用前面封装好的 respond 方法执行回调操作
          respond(event, route.handler)
          break
        }
      }
    })
  }

  registerRoute (rule, handler) {
    this.routes.push({rule, handler})
  }
}
```

有了这个 Router 类之后，开发者将只需关心如何进行资源请求的规则匹配和响应操作的实现问题。接下来我们使用 Router 来改写本节开篇的实例：

```js
const router = new Router()

router.registerRoute(
  '/data.txt',
  () => new Response('Hello World!')
)
```

## 小结

本节内容主要介绍了如何在 Service Worker 中监听 `fetch` 事件来实现对资源请求拦截代理，介绍了如何通过 event.request 进行资源请求判断，如何通过 event.respondWith 实现对资源请求的响应。最后实现了 Router 类来实现对资源请求和响应操作的统一管理。在下一节，将会进一步探讨资源响应的策略。
