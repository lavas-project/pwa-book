# Cache API

在上一节 Fetch API 的介绍当中提到，Fetch API 提供了 Request、Response 等偏底层的类对象，这样就能够以统一的形式将资源的请求与响应过程应用到更多的场景当中。本节所介绍的 Cache API 就属于另一种资源请求与响应的场景，Cache API 提供了一系列方法实现了请求响应对象的缓存管理，因此它可以作为资源请求响应的缓存仓库，为 Service Worker 实现离线缓存提供基础支持。

接下来将介绍 Cache API 的使用方法。

## 兼容性检测

截止本书定稿之前，除了 IE 之外几乎所有主流浏览器的最新版本都支持了 Cache API，但保险起见，我们可以在主线程或者 Worker 线程中通过判断全局变量 `caches` 是否存在来检测浏览器是否支持 Cache API：

```js
if ('caches' in self) {
  console.log('当前环境支持 Cache API')
}
```

## 打开 Cache 对象

通过 `caches.open()` 方法可以打开一个 Cache 对象，其语法为：

```js
caches.open(cacheName).then(cache => {/* 获得 Cache 对象 */})
```

其中参数 cacheName 表示要打开的 Cache 对象的名称。该方法是异步方法，返回的 Promise 对象在 resolve 时会返回成功打开的 Cache 对象。打开 Chrome 开发者工具，切换到 Application - Cache Storage 选项卡可以观察到，在执行 `caches.open()` 方法时，会在 Cache Storage 下边建立同名仓库，每个仓库里面的内容就是操作对应的 Cache 对象后写入的资源缓存。

![Cache Storage 根据名称新建仓库](./img/caches-open.png)

## 添加缓存

Cache 对象提供了 `put()`、`add()`、`addAll()` 三个方法来添加或者覆盖资源请求响应的缓存。需要注意的是，这些添加缓存的方法只会对 GET 请求起作用。

### Cache.put(request, response)

资源请求响应在通过 Cache API 进行存储的时候，会以请求的 Request 对象作为键，响应的 Response 对象作为值，因此 `put()` 方法需要依次传入资源的请求和响应对象，然后生成键值对并缓存起来。下面举例说明它的使用方法：

```js
// 假设 cache 由 caches.open('v1') 打开
cache.put(
  new Request('/data.json'),
  new Response(JSON.stringify({name: 'lilei'}))
)
```

这样就给 v1 仓库写入了 '/data.json' 请求与响应的缓存。通过开发者工具可以明显地看到仓库当中新增的缓存条目信息：

![通过 Cache.put() 方法添加缓存](./img/cache-put.png)

同样，我们可以结合 Fetch API 来获取并存储服务端所返回的资源：

```js
fetch('/data.json').then(response => {
  if (response.ok) {
    cache.put(new Request('/data.json'), response)
  }
})
```

在 Fetch API 的章节中介绍了 Request 和 Response 都基于数据流实现，因此在进行缓存的时候需要格外留意 Response 对象的响应体数据是否已经被读取。

### Cache.add(request) 和 Cache.addAll(requests)

`add()` 和  `addAll()` 方法的功能类似于 Fetch API 结合 `put()` 方法实现对服务端资源的抓取和缓存。`add()` 和 `addAll()` 的区别在于，`add()` 只能请求和缓存一个资源，而 `addAll()` 能够抓取并缓存多个资源。有了这两个方法，缓存服务端资源将变得更为简单：

```js
cache.add('/data.json').then(() => {/* 缓存成功 */})
cache.addAll([
  '/data.json',
  '/info.txt'
])
.then(() => {/* 缓存成功 */})
```

`add()` 和 `addAll()` 方法会缓存 Response.ok 为 true 的响应。同时请求跨域资源返回了不透明的 Response 对象，同样也会缓存下来。

## 查找缓存

`cache.match()` 和 `cache.matchAll()` 可以实现对缓存的查找。其中 `match()` 会返回第一个匹配条件的缓存结果，而 `matchAll()` 则会返回所有满足匹配条件的缓存结果。下面举例说明如何查找“/data.json”的缓存资源，相关代码如下所示：

```js
// 使用 match() 进行查找
cache.match('/data.json').then(response => {
  if (response == null) {
    // 没有匹配到任何资源
  }
  else {
    // 成功匹配资源
  }
})
// 使用 matchAll() 进行查找
cache.matchAll('/data.json').then(responses => {
  if (!responses.length) {
    // 没有匹配到任何资源
  }
  else {
    // 成功匹配到资源
  }
})
```

上述查找方法可以传入第二参数来控制匹配过程，比如设置 ignoreSearch 参数，会在匹配过程中忽略 URL 中的 Search 部分，下面通过代码举例说明这一匹配过程：

```js
// 假设缓存的请求 URL 为 /data.json?v=1
cache.match('/data.json?v=2', {ignoreSearch: true}).then(response => {
  // 匹配成功
})
```

在上面的例子当中，缓存的 URL 和用于匹配的 URL 都带有 Search 参数，但由于配置了 ignoreSearch 值为 true，因此最终仍然匹配成功。

## 获取匹配的请求

前面介绍的 `match()`、`matchAll()` 方法会返回匹配到的响应，但如果需要获取匹配到的请求，可以通过 `cache.keys()` 方法实现：

```js
cache.keys('/data.json', {ignoreSearch: true}).then(requests => {
  // requests 可能包含 /data.json、/data.json?v=1、/data.json?v=2 等等请求对象
  // 如果匹配不到任何请求，则返回空数组
})
```

如果没有传入任何参数，`cache.keys()` 会默认返回当前 Cache 对象中缓存的全部请求：

```js
cache.keys().then(requests => {
  // 返回全部请求对象
})
```

## 删除缓存

通过 `cache.delete()` 方法可以实现对缓存的清理。其语法如下所示：

```js
cache.delete(request, options).then(success => {
  // 通过 success 判断是否删除成功
})
```

比如要删除前面添加成功的“/data.json”请求，相关代码如下所示：

```js
cache.delete('/data.json').then(success => {
  // 将打印 true，代表删除成功
  console.log(success)
})
```

假如删除一个未被缓存的请求，则执行删除后返回的 success 为 false：

```js
cache.delete('/no-cache.data').then(success => {
  // 将打印 false，代表删除失败
  console.log(success)
})
```

在调用 `cache.delete()` 时可以传入第二参数去控制删除操作中如何匹配缓存，其格式与 `match()`、`matchAll()` 等匹配方法的第二参数一致。因此下面举例的删除过程能够忽略 Search 参数：

```js
// 假设缓存的请求 URL 为 /data.json?v=1.0.1
// 那么设置 ignoreSearch 之后同样也回删除该缓存
cache.delete('/data.json', {ignoreSearch: true}).then(success => {
  // /data.json?v=1.0.1 已被成功删除
})
```
