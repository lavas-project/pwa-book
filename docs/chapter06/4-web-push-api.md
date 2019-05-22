# 网络推送

在上一节我们已经介绍了使用 Notification API 如何创建推送并展示给用户，但是当浏览器没有打开，Service Worker 处于休眠状态时，如何将通知推送给用户呢？Native App 很早就实现了离线通知，用户在没有打开应用的情况下，也能够接收到推送的内容并且在通知栏展现出来。现在 Web App 使用 Push API 也可以实现离线接收消息。

Push API 和 Notification API 是不同但互补的功能，Push API 是用于订阅并推送消息给 Service Worker，而 Notification API 用于从 Service Worker 发送消息给用户。

一个完整的 Web Push 流程，只有浏览器是不够的，还需要服务端发送消息。在本节中，我们不仅会介绍消息推送在浏览器端相关的细节，还会实现一个简单的 Node.js 服务端来推送消息。

## 推送流程

在介绍 Push API 的用法之前，首先我们需要了解一下建立网络推送的基本流程。

下图所示的流程图出自 [Web Push 协议草案](https://tools.ietf.org/html/draft-ietf-webpush-protocol-12#section-2)，展示网络推送实现的整个基本流程。Web Push 协议是发送推送消息到浏览器的协议标准。它描述了如何创建推送消息，加密推送消息并将其发送到推送消息传递平台的结构和流程。

```bash
    +-------+           +--------------+       +-------------+
    |  UA   |           | Push Service |       | Application |
    +-------+           +--------------+       |   Server    |
        |                      |               +-------------+
        |      Subscribe       |                      |
        |--------------------->|                      |
        |       Monitor        |                      |
        |<====================>|                      |
        |                      |                      |
        |          Distribute Push Resource           |
        |-------------------------------------------->|
        |                      |                      |
        :                      :                      :
        |                      |     Push Message     |
        |    Push Message      |<---------------------|
        |<---------------------|                      |
        |                      |                      |
```

从图中可以看出，网络推送的建立涉及到三端的相互配合，分别是：

1. UA（User Agent），即浏览器；
2. Push Service，即推送服务器，用于管理推送订阅、消息推送等功能的第三方服务器。该服务器是浏览器决定的；
3. Application Server，即网站应用的后端服务。

网络推送的过程中，浏览器和后端服务并不是直接接触的，需要通过浏览器指定的第三方推送服务器进行消息中转。

从具体的推送步骤上进行划分，又可以分成订阅（Subscribe）与推送（Push Message）两个部分。

其中订阅部分包含以下步骤：

1. Subscribe，浏览器需要向推送服务器发起推送订阅的请求；
2. Monitor，订阅成功之后，浏览器与推送服务器之间会进行通信，同时推送服务器会生成并维护相关订阅信息，在后续的消息推送流程将基于该订阅信息与浏览器保持通信；
3. Distribute Push Resource，浏览器将推送服务器返回的订阅信息发送给网站后端服务进行保存，服务端将基于该订阅信息向推送服务器发起消息推送。

而推送部分主要分为两步：

1. 后端服务通过 Web Push 向推送服务器发送消息通知，发送时会将前面提到的订阅信息带上，以告知推送服务器这条消息推送的目的地；
2. 推送服务器接收到消息之后，再根据订阅信息将消息推送给对应的浏览器。

至此就完成了整个推送流程。

接下来，我们将对推送流程的具体步骤进行介绍。

## 订阅推送

在我们可以发送推送消息之前，必须先订阅推送服务。Push API 提供 PushManager 接口请求和推送通知，在第四章 Service Worker 的学习中我们知道，当 Service Worker 注册成功时，会返回一个 `ServiceWorkerRegistration` 的实例对象 `registration`，其中 `PushManager` 的实例 `pushManager` 就挂到了 `registration` 对象下面，因此我们可以通过调用 `registration.pushManager.subscribe()` 进行订阅。

由于存在兼容性问题，因此在调用之前需要判断 `PushManager` 是否存在：

```js
if (window.PushMananger !== null) {
  // 发起推送订阅
}
```

假设用户启用了通知，现在我们可以订阅推送服务：

```js
async function subscribe () {
  // 判断兼容性
  if (window.PushManager == null && navigator.serviceWorker == null) {
    return
  }
  // 注册 service-worker.js 获取 ServiceWorkerRegistration 对象
  let registration = await navigator.serviceWorker.register('/service-worker', {scope: '/'})
  // 发起推送订阅
  let pushSubscription = await registration.pushManager.subscribe({
    userVisibleOnly：true,
    applicationServerKey: base64ToUint8Array('BLjmecELgzCq4S-fJyRx9j03wvR0yjSs6O13L6qABrj7CadS8689Lvi2iErzG8SeaPSX_ezoyD2O0MMkGZcj4c0')
  })
  // 将 pushSubscription 发送给应用后端服务器
  await distributePushResource(pushSubscription)
}
```

在上面的实例中，subscribe 方法接受 `userVisibleOnly` 参数，如果该参数为 true 但没有调用 Notification API 时，浏览器会弹出默认的提示框提示有应用程序在后台运行，确保每个消息都有匹配的通知。对于部分浏览器而言（如 Chrome for Android），该属性必须设置为 true，不然会报错。

订阅成功后，推送服务器返回订阅信息 `pushSubscription` 对象， `pushSubscription` 的结构如下：

```javascript
{"endpoint":"https://fcm.googleapis.com/fcm/send/dpH5lCsTSSM:APA91bHqjZxM0VImWWqDRN7U0a3AycjUf4O-byuxb_wJsKRaKvV_iKw56s16ekq6FUqoCF7k2nICUpd8fHPxVTgqLunFeVeB9lLCQZyohyAztTH8ZQL9WCxKpA6dvTG_TUIhQUFq_n",
"keys": {
    "p256dh":"BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk=",
    "auth":"4vQK-SvRAN5eo-8ASlrwA=="
  	}
}
```

pushSubscription 包含公钥和 endpointURL，应用服务器推送时可以使用公钥对消息加密，endpointURL 是由推送服务器生成包含唯一标识符的 URL，推送服务器通过它判断将消息发送到哪个客户端。

可分别通过 `pushSubscription.getKey('p256dh')` 和 `pushSubscription.getKey('auth')` 来获取密钥和校验码信息。由于通过 `getKey()` 方法获取到的密钥信息类型为 `ArrayBuffer`，因此还需要通过转码将其转成 base64 字符串以便于传输。转换函数如下所示：

```js
function uint8ArrayToBase64 (arr) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(arr)))
}
```

这样，我们只需要将 `pushSubscription` 的 `endpoint`、`p256dh`、`auth` 进行包装并发送 POST 请求传给应用服务器，应用服务器只需要将这个 pushSubscription 接收到并保存起来即可。比如在这里使用 Fetch API 来演示数据传输：

```js
function distributePushResource (pushSubscription) {
  return fetch('/path/to/subscribe', {
    method: 'post',
    body: JSON.stringify({
      endpoint: pushSubscription.endpoint,
      keys: {
        p256dh: uint8ArrayToBase64(pushSubscription.getKey('p256dh')),
        auth: uint8ArrayToBase64(pushSubscription.getKey('auth'))
      }
    })
  })
}
```

以上就是推送订阅的说明。订阅好推送之后，下面就能够接收推送信息了。

## 使用 VAPID

读者可能已经注意到，在上文订阅推送 subscribe 方法中，还传入了一个 applicationServerKey 参数给推送服务，这个参数的作用是什么呢？

Web Push  协议出于用户隐私考虑，在应用和推送服务器之间没有进行强身份验证，这为用户应用和推送服务都带来了一定的风险。解决方案是对 Web Push 使用自主应用服务器标识（VAPID）协议，VAPID 规范允许应用服务器向推送服务器标识身份，推送服务器知道哪个应用服务器订阅了用户，并确保它也是向用户推送信息的服务器。使用 VAPID 服务过程很简单，通过几个步骤可以理解 VAPID 如何实现安全性。

- 应用服务器创建一对公钥/私钥，并将公钥提供给 Web App 客户端
- 当用户尝试订阅推送服务时，将公钥添加到 subscribe() 订阅方法中，公钥将被发送到推送服务保存。
- 应用服务器想要推送消息时，发送包含公钥和已经签名的 JSON Web 令牌到推送服务提供的 API，推送服务验证通过后，将信息推送至 Web App 客户端。

为了避免处理过多加密细节，在这里我们只需简单了解 VAPID 规范即可，因为目前已经有很多库来帮助开发者生成公钥，从而大大减少开发工作量。假设开发者使用 Node.js 作为服务端语言，那么可以通过安装 `web-push` 来协助生成公钥。

首先通过 `npm install` 安装 `web-push`：

```shell
npm install web-push -g
```

然后就可以通过命令行生成公钥和私钥了：

```shell
web-push generate-vapid-keys
```

得到的结果如下所示：

```shell
=======================================

Public Key:
BLjmecELgzCq4S-fJyRx9j03wvR0yjSs6O13L6qABrj7CadS8689Lvi2iErzG8SeaPSX_ezoyD2O0MMkGZcj4c0

Private Key:
wNY2Jw8Zcw2wjfsiVzIxQB6K-ZoOkn-MS7fXxoo8w0Y

=======================================
```

正如在订阅推送中提到的，subscribe 方法通过 applicationServerKey 传入所需要的公钥。一般来说得到的公钥一般都是 base64 编码后的字符串，需要将其转换成 `Uint8Array` 格式才能作为 subscribe 的参数传入。下面给出一个 base64 转 Uint8Array 的函数实现：

```javascript
function base64ToUint8Array (base64String) {
  let padding = '='.repeat((4 - base64String.length % 4) % 4)
  let base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')
  let rawData = atob(base64)
  let outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
```

在下文中我们也会继续了解，在消息推送服务端如何使用 VAPID 协议。

## 消息推送

接下来介绍如何使用 Web Push 协议向浏览器发送推送消息，消息推送需要依赖浏览器接收推送消息和后端服务推送消息两个部分。

### 浏览器接收推送消息

首先我们来研究浏览器如何接收推送消息。在完成推送订阅之后，浏览器与推送服务器建立了通信，此时浏览器可以通过监听 `push` 事件来接收推送服务发送的消息。

`push` 事件只会在 Service Worker 作用域下触发，因此只需要在 Service Worker 作用域下注册监听该事件即可：

```js
self.addEventListener('push', function (e) {
  if (e.data) {
    // 显示推送消息
    console.log(e.data.text())
  }
})
```

消息通过事件回调下面的 `data` 属性获取。`data` 提供了以下方法来实现不同类型的消息进行解析：

- `arrayBuffer()`：将消息解析成 ArrayBuffer 对象；
- `blob()`：将消息解析成 Blob 对象；
- `json()`：将消息解析成 JSON 对象；
- `text()`：将消息解析成字符串；

需要注意的是，当推送服务器推送的消息没有任何数据时，`data` 属性可能为空，因此需要做好代码容错。

### 后端服务推送消息

当浏览器做好推送通知的接收工作之后，接下来需要实现后端服务推送消息。正如前面所提到的那样，第三方推送服务是由浏览器决定的，因此可能存在不同的浏览器对应不一样的第三方推送服务，而不同的第三方推送服务所要求的后端配置也是不一样的，因此在开发的时候，需要针对不同浏览器的不同推送服务，开发不同的后端推送服务，当然也可以选择一些现成的跨平台推送方案，如 [OneSignal](https://onesignal.com/)，这些跨平台推送方案已经集成好了多种浏览器的推送服务，使得开发者不再需要去关心不同浏览器的推送服务适配问题。

在这里我们演示一段基于 Chrome 浏览器的后端推送服务代码。Chrome 浏览器所对应的推送服务器为 Firebase 云服务（FCM），假设应用服务后端使用 Node.js，那么我们可以使用 `web-push` 库来实现后端向推送服务器发送消息的方法：

```js
const webpush = require('web-push')

const vapidKeys = {
  publicKey: 'BLjmecELgzCq4S-fJyRx9j03wvR0yjSs6O13L6qABrj7CadS8689Lvi2iErzG8SeaPSX_ezoyD2O0MMkGZcj4c0',
  privateKey: 'wNY2Jw8Zcw2wjfsiVzIxQB6K-ZoOkn-MS7fXxoo8w0Y'
}
webpush.setVapidDetails(
  'mailto:your-email@provider.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

webpush.setGCMAPIKey('<Your GCM API Key Here>')

module.exports = function pushMessage (pushSubscription, message) {
  return webpush.sendNotification(pushSubscription, message)
}
```

其中 `vapidKeys` 就是生成的公钥和私钥，它们也可以通过 `webpush.generateVAPIDKeys()` 在程序运行时调用该函数生成。但需要注意的是，公钥和私钥只需要生成一次，后续直接使用生成好的值即可。生成的公钥和私钥需要传入 `webpush.setVapidDetails()` 函数中对 `web-push` 进行配置。

接着是 `webpush.setGCMAPIKey()`，这个函数需要传入 Firebase 云服务（FCM）申请到的 GCMAPIKey。

配置好之后，就可以使用 `webpush.sendNotification()` 方法推送消息了。该方法第一个参数需要传入 `pushSubscription`，也就是推送订阅的最后一步中，浏览器向后端服务发送的 pushSubscription 对象。

后端服务在存储 pushSubscription 的时候，需要做好用户信息与 pushSubscription 的映射关系，这样，后续想要给哪个用户推送消息，只需要获取对应的 pushSubscription 即可。

`sendNotification()` 方法传入的第二个参数就是想要推送给用户的信息，它可以是字符串、或者 node Buffer。比如我们可以通过 `JSON.stringify(obj)` 的方式来向浏览器推送一个对象信息：

```js
webpush.sendNotification(pushSubscription, JSON.stringify({
  msg: 'Hello World',
  url: 'https://www.baidu.com'
}))
```

那么在浏览器就可以通过如下方式接收信息：

```js
self.addEventListener('push', e => {
  let payload = e.data.json()
  console.log(payload.msg)
  console.log(payload.url)
})
```

这样，就实现了应用后端向浏览器推送消息的流程。

## 取消订阅

当网站在完成推送订阅之后，Web Push API 也提供了相应的方法来取消订阅。前面提到推送订阅成功之后 `PushManager.subscribe()` 方法返回的 `pushSubscription` 对象上有一个 `unsubscribe()` 就是用来取消订阅的：

```js
pushSubscription.unsubscribe().then(function () {
  console.log('取消订阅成功！')
})
```

在取消订阅之前，我们可以通过 `PushManager.getSubscription()` 方法来判断用户是否已经订阅，如果用户已经订阅过，那么该函数会返回 `pushSubscription` 对象，这样接下来再调用 `unsubscribe()` 方法最终取消订阅。完整的代码如下所示：

```js
registration.pushManager.getSubscription().then(function (pushSubscription) {
  if (!pushSubscription) {
    // 用户尚未订阅
    return
  }
  // 取消订阅
  return pushSubscription.unsubscribe()
})
.then(function () {
  console.log('取消订阅！')
})
```

## 结合 Notification 实现离线通知推送

有了 Push API，结合前面学习到的 Notification API 和 clients，我们就能够做到完整的离线通知推送了。接下来我们通过一个例子，来实现在离线情况下接收推送通知，点击通知后自动打开网页的这么一个功能。

在命令行中运行如下命令，下载示例代码到本地。

```bash
# 从 GitHub 下载代码到本地 pwa-book-demo 目录
$ git clone https://github.com/lavas-project/pwa-book-demo.git

# 进入到 chapter06/web-push 目录
$ cd chapter06/web-push

# 安装 npm 依赖
$ npm install
```

首先我们通过执行 `web-push generate-vapid-keys  `命令生成 VAPIDKeys，在 `server/config.js` 文件中配置 VAPIDKeys 公钥和私钥，以及配置  Firebase 云服务（FCM）生成的 `GCMAPIkey`。

```javascript
module.exports = {
  VAPIDKeys: {
    publicKey: '<Your Public Key>',
    privateKey: '<Your private Key>'
  },
  GCMAPIkey: 'FCM Public Key'
}
```

接下来我们需要准备主线程 JS 文件，用来完成注册 Service Worker、申请桌面通知权限、订阅推送等等工作，可查看示例中 `public/script.js` 文件。

```js
// entry.js
const VAPIDPublicKey = '<Your Public Key>'
// 注册 service worker 并缓存 registration
let registration
function registerServiceWorker () {
  if (!navigator.serviceWorker) {
    return Promise.reject('系统不支持 service worker')
  }

  return navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
    registration = reg
  })
}

// 申请桌面通知权限
function requestNotificationPermission () {
  // 系统不支持桌面通知
  if (!window.Notification) {
    return Promise.reject('系统不支持桌面通知')
  }
  return Notification.requestPermission()
    .then(function (permission) {
      if (permission === 'granted') {
        return Promise.resolve()
      }
      return Promise.reject('用户已禁止桌面通知权限')
    })
}

// 订阅推送并将订阅结果发送给后端
function subscribeAndDistribute (registration) {
  if (!window.PushManager) {
    return Promise.reject('系统不支持消息推送')
  }
  // 检查是否已经订阅过
  return registration.pushManager.getSubscription().then(function (subscription) {
    // 如果已经订阅过，就不重新订阅了
    if (subscription) {
      return
    }
    // 如果尚未订阅则发起推送订阅
    let publicKey = 'BLjmecELgzCq4S-fJyRx9j03wvR0yjSs6O13L6qABrj7CadS8689Lvi2iErzG8SeaPSX_ezoyD2O0MMkGZcj4c0'

    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(publicKey)
    })
      // 订阅推送成功之后，将订阅信息传给后端服务器
      .then(function (subscription) {
        distributePushResource(subscription)
      })
  })
}

function distributePushResource (subscription) {
  // 假设后端接收并存储订阅对象的接口为 '/api/push/subscribe'
  return fetch('/api/push/subscribe', {
    method: 'post',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: uint8ArrayToBase64(subscription.getKey('p256dh')),
        auth: uint8ArrayToBase64(subscription.getKey('auth'))
      }
    })
  })
}
// 注册 service worker
registerServiceWorker()
  // 申请桌面通知权限
  .then(function () {
    requestNotificationPermission()
  })
  // 订阅推送
  .then(function () {
    subscribeAndDistribute(registration)
  })
  .catch(function (err) {
    console.log(err)
  })
```

在 `public/sw.js` 文件中，做好推送事件和通知点击事件的监听：

```js
// 监听 push 事件
self.addEventListener('push', function (e) {
  if (!e.data) {
    return
  }
  // 解析获取推送消息
  let payload = e.data.json()
  // 根据推送消息生成桌面通知并展现出来
  let promise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    data: {
      url: payload.url
    }
  })
  e.waitUntil(promise)
})
// 监听通知点击事件
self.addEventListener('notificationclick', function (e) {
  // 关闭窗口
  e.notification.close()
  // 打开网页
  e.waitUntil(clients.openWindow(e.data.url))
})
```

然后我们准备一个简单的 `public/index.html` 文件作为前端入口：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
  <title>Web Push API</title>
</head>
<body>
  <h1>你好，很高兴认识你</h1>
  <script src="/entry.js"></script>
</body>
</html>>
```

接下来准备服务端代码 `server/index.js`，服务端代码主要做两件事情：

1. 提供接口存储 pushScription 对象；
2. 跑定时任务，每隔一小时就向所有订阅过的浏览器推送消息；

```javascript
// server.js

const webpush = require('web-push')
const express = require('express')
const path = require('path')

// 配置 web push
webpush.setVapidDetails(
  'mailto:your-email@provider.com',
  'BLjmecELgzCq4S-fJyRx9j03wvR0yjSs6O13L6qABrj7CadS8689Lvi2iErzG8SeaPSX_ezoyD2O0MMkGZcj4c0',
  'wNY2Jw8Zcw2wjfsiVzIxQB6K-ZoOkn-MS7fXxoo8w0Y'
)
webpush.setGCMAPIKey('<Your GCM API Key Here>')

// 存储 pushSubscription 对象
let pushSubscriptionSet = new Set()

// 定时任务，每隔 10 分钟向推送服务器发送消息
setInterval(function () {
  if (pushSubscriptionSet.size > 0) {
    pushSubscriptionSet.forEach(function (pushSubscription) {
      webpush.sendNotification(pushSubscription, JSON.stringify({
        title: '你好',
        body: '我叫李雷，很高兴认识你',
        icon: 'https://path/to/icon',
        url: 'http://localhost'
      }))
    })
  }
}, 10 * 60)

const app = new express()

// 服务端提供接口接收并存储 pushSubscription
app.post('/api/push/subscribe', function (req, res) {
  if (req.body) {
    try {
      pushSubscriptionSet.add(req.body)
      res.sendStatus(200)
    } catch (e) {
      res.sendStatus(403)
    }
  } else {
    res.sendStatus(403)
  }
})

// 静态资源
app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'index.html'))
})
app.get('/entry.js', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'entry.js'))
})
app.get('/service-worker.js', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'service-worker.js'))
})
// 启动服务器
app.listen(80, function () {
  console.log('服务端启动了')
})
```

准备好上述文件之后，配置完成后通过以下命令启动示例，在看到命令行中输出 `Server start on: http://127.0.0.1:8088`，意味着已经成功启动。

```bash
# 安装成功后启动 chapter06/web-push 示例

$ npm run server
```

这时打开浏览器，访问 `http://127.0.0.1:8088` 便开始注册 Service Worker、获取桌面通知权限、订阅推送；之后关闭网页，每间隔 10 分钟，后端服务都会向推送服务器发送消息，同时推送服务器将再将消息推送至浏览器，浏览器接收到消息之后将弹出桌面通知，显示文案 “我叫李雷，很高兴认识你” ；接着点击通知之后，将自动打开浏览器同时打开 `http://127.0.0.1:8088`。

这样，整个过程就实现了离线桌面通知的展示以及引导用户打开页面回到站点的流程。上述例子只是一个粗糙的功能演示，开发者可以顺着思路与具体的项目需求去活学活用这个强大的功能。


