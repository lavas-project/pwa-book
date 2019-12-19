# 本地存储管理

在上一节解决了如何对资源请求进行拦截代理之后，要实现网页的离线缓存还需要解决本地存储的选择与管理问题。

从前面学习中我们知道，处于同一作用域下的网页会共用一个 Service Worker 线程，这个 Service Worker 会同时处理来自不同页面的资源请求的拦截和响应，因此基于性能上的考虑，Service Worker 在设计标准时就要求了任何耗时操作都必须异步实现。这也就导致了在 Service Worker 作用域下能够使用的缓存策略只有 Cache API 和 IndexedDB，因为目前只有二者在功能实现上全部采用了异步形式，而其他诸如 localStorage 属于同步方法，因此无法在 Service Worker 中使用。

关于 Cache API 和 IndexedDB 在第三章基础技术的简介当中已经做了详细介绍，因此本节的重点将主要放在二者的对比，分析二者的使用场景，在使用时需要关心的注意事项等方面，并在最后举例说明如何结合两种存储方式来实现离线缓存的。

## Cache API 与 IndexedDB 的应用场景

Cache API 是为资源请求与响应的存储量身定做的，它采用了键值对的数据模型存储格式，以请求对象为键、响应对象为值，正好对应了发起网络资源请求时请求与响应一一对应的关系。因此 Cache API 适用于请求响应的本地存储。

IndexedDB 则是一种非关系型（NoSQL）数据库，它的存储对象主要是数据，比如数字、字符串、Plain Objects、Array 等，以及少量特殊对象比如 Date、RegExp、Map、Set 等等，对于 Request、Response 这些是无法直接被 IndexedDB 存储的。

可以看到，Cache API 和 IndexedDB 在功能上是互补的。在设计本地资源缓存方案时通常以 Cache API 为主，但在一些复杂的场景下，Cache API 这种请求与响应一一对应的形式存在着局限性，因此需要结合上功能上更为灵活的 IndexedDB，通过 IndexedDB 存取一些关键的数据信息，辅助 Cache API 进行资源管理。

## 缓存管理注意事项

在进行本地存储开发的时候，需要注意以下几个问题。

### 本地存储空间是有限的

任何缓存都是有容量大小限制的，Cache API 和 IndexedDB 都不例外。不同的浏览器在分配策略上可能存在不同，一般都会分配出一个较大的存储空间来供这些存储 API 使用。浏览器通常不会主动清除缓存资源，但是如果数据存储容量较大以至于超出浏览器配额时，这时便无法写入资源导致存储失败。

这时浏览器会采用 LRU（Least Recently Used）算法根据数据的历史访问记录来淘汰数据以清理出可存储空间，但这个行为属于浏览器的主动行为不受开发者所控制，可能会导致这部分被清理的缓存资源访问失败。

因此在设计缓存方案时，应该做好缓存资源的过期失效和清理工作，尽量避免被动触发浏览器的资源清理。同时为了满足更加精细化的缓存管理，浏览器提供了 StorageEstimate API 去查询当前缓存空间的使用情况，这样我们就可以利用这些数据来更好地管理缓存资源。其使用方法如下所示：

```js
navigator.storage.estimate()
  .then(estimate => {
    // 设备为当前域名所分配的存储空间总大小
    console.log(estimate.quota)
    // 当前域名已经使用的存储空间大小
    console.log(estimate.usage)
  })
```

### 资源的存取过程可能会失败

资源在写入存储和读取的过程中都存在失败的可能。

写入失败的原因有很多，比如前面提到的存储资源大小超出浏览器配额时，就会被浏览器限制写入。此外，在隐身模式或者是用户未授权的情况下，一些浏览器同样不允许进行存储操作。

本地的存储资源是完全可以被用户访问的，因此用户随时可能对这些存储资源进行修查找对应资源改或删除。一般来说用户修改数据的情况比较少见，但是清除数据还是很常见的，只要用户主动进行浏览器数据清理操作，就会导致存储数据的丢失。

所以应该随时做好存取失败时的异常捕获与降级方案，确保程序运行时不会出错。

### 存储的资源可能会过期

即使在存取过程没有发生任何意外的前提下，存储的资源本身也可能会存在过期失效的问题。资源过期就意味着资源是无用甚至错误的，使用这些过期资源会带来各种意想不到的问题，因此要及时做好资源的更新和旧资源的清理工作。

## 缓存管理实现

接下来我们将通过 CacheWrapper 来统一实现缓存的管理。CacheWrapper 的基本思路是实现对 Cache API 的封装，分别在执行 `cache.put()` 和 `cache.match()` 的时候依次完成对缓存对象的更新和旧资源的清理。资源过期信息存放在 IndexedDB 当中，我们可以使用在第三章中封装了 IndexedDB 的 DB 类来简化 IndexedDB 的操作。

### 构造函数

CacheWrapper 需要传入两个参数 cacheName 和 expireOptions。其中 cacheName 为缓存名称，用于获取 cache 对象以及实例化 db。expireOptions 为资源过期的配置信息，在这里我们只演示资源超时过期的管理，因此只需要传入 maxAgeSeconds 参数规定资源的过期时长即可。

```js
class CacheWrapper {
  constructor ({
    cacheName,
    expireOptions: {
      maxAgeSeconds
    }
  }) {
    this.cacheName = cacheName
    this.maxAgeSeconds = maxAgeSeconds
  }
}
```

这样我们可以通过如下方式实例化 CacheWrapper：

```js
const cacheWrapper = new CacheWrapper({
  // 给缓存起个名
  cacheName: 'resource-cache',
  // 假设缓存 1 星期之后资源过期
  expireOptions: {
    maxAgeSeconds: 7 * 24 * 60 * 60
  }
})
```

### 获取 cache 和 db 对象实例

接下来需要定义获取 cache 对象和 db 对象的方法，通过 this.cacheName 指定名称可以获得通过如下方法分别获得：

```js
class CacheWrapper {
  // ...

  async getCache () {
    if (!this.cache) {
      this.cache = await caches.open(this.cacheName)
    }
    return this.cache
  }

  getDB () {
    if (!this.db) {
      this.db = new DB({storeName: this.cacheName})
    }
    return this.db
  }
}

```

有了 getCache() 和 getDB() 之后，就可以在后续的方法实现当中直接调用这两个方法分别获得当前的 cache 和 db 对象了。

### 写入资源的同时记录资源过期时间

在调用 cache.put() 方法的时候一般用于新增或者更新本地资源，此时应该同步更新缓存的过期时间。由于传入的 maxAgeSeconds 单位是秒，因此在计算过期时间的时间戳时需要乘以 1000 换算成毫秒：

```js
class CacheWrapper {
  // ...

  async set (request, response) {
    // 获取 db 对象
    let db = this.getDB()
    // 获取 cache 对象
    let cache = await this.getCache()
    // 同时更新本地缓存与资源所对应的过期时间
    await Promise.all([
      cache.put(request, response),
      db.setItem(request.url, Date.now() + this.maxAgeSeconds * 1000)
    ])
    // 清理过期资源，无需阻塞异步方法的执行
    this.deleteExpires()
  }
}
```

### 读取资源时排除过期资源

在调用 cache.match() 方法查询本地资源的同时，应该确认对应资源是否过期，只有当资源未过期时再将资源返回结果：

```js
class CacheWrapper {
  // ...

  async get (request) {
    // 获取 db 对象
    let db = this.getDB()
    // 获取 cache 对象
    let cache = await this.getCache()
    // 同时读取资源及其过期时间
    let [response, expireTime] = await Promise.all([
      cache.match(request),
      db.getItem(request.url)
    ])
    // 如果未超时则代表资源没过期，将读取到的资源返回
    // 如果资源过期则不返回任何内容
    if (expireTime > Date.now()) {
      return response
    }
    // 清理过期资源，无需阻塞异步方法的执行
    this.deleteExpires()
  }
}
```

### 过期资源清理方法实现

在调用 CacheWrapper 的 `set()` 和 `get()` 方法结束前，都调用了 `deleteExpires` 统一进行过期资源清理，其方法的实现如下所示：

```js
class CacheWrapper {
  // ..

  async deleteExpires () {
    // 获取 db 对象
    let db = this.getDB()
    // 获取 cache 对象
    let cache = await this.getCache()
    // 获取全部资源的过期信息
    let map = await db.getAll()
    if (!map) {
      return
    }
    let now = Date.now()
    // 遍历所有过期信息，并对过期资源进行清理
    for (let [url, expireTime] of map) {
      if (expireTime <= now) {
        await cache.delete(url)
      }
    }
  }
}
```

### 利用 CacheWrapper 实现对资源的过期管理

这样我们就可以通过使用 CacheWrapper 实现对资源进行简易的过期管理。比如下面的例子所展示的，结合 Router 实现对图片资源的过期清理。在这个例子中，我们优先从本地缓存中读取图片资源，如果资源尚未被缓存或者资源过期，则发起网络请求获取最新资源并缓存到本地。利用 CacheWrapper 可以非常方便地实现缓存过期管理：

```js
const router = new Router()
// 实例化 cacheWrapper 对象
const cacheWrapper = new CacheWrapper({
  // 单独给图片资源分配缓存名称
  cacheName: 'image-cache',
  expireOptions: {
    // 对图片资源缓存 1 星期
    maxAgeSeconds: 7 * 24 * 60 * 60
  }
})
router.registerRoute(/\.(jpe?g|png)$/, async request => {
  // 优先读取本地缓存中的图片
  // 如果本地无缓存图片/缓存过期/读取缓存出错，则 response 为空
  let response = await cacheWrapper.get(request).catch(() => {})
  if (response) {
    return response
  }
  // 如果本地尚未缓存或者缓存过期，则发起网络请求获取最新图片资源
  response = await fetch(request.clone())
  // 如果请求成功，则更新缓存
  // 更新缓存过程无需阻塞进程
  if (response.ok) {
    cacheWrapper.set(request, response.clone())
  }
  // 返回资源
  return response
})
```

资源管理除了上面所演示的过期管理之外，还可以对某一类资源限制存储的数量，比如限制图片最多缓存 10 张等等，这些管理方案都可以通过 Cache API 与 IndexedDB 相结合的方式实现，在这里就不一一做演示了，读者可以根据 CacheWrapper 的思路进行相关功能的实现。
