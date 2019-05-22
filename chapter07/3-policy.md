## 同源策略

上一节介绍 CSP 时，我们提到了浏览器的同源策略，同源策略是 Web 安全的基础，它对从一个源加载的资源如何与来自另一个源的资源进行交互做出了限制。这是一个用于隔离潜在恶意文件的关键安全机制，每个源均与其他网络保持隔离，从而为开发者提供一个可进行构建和操作的安全沙盒。

如果没有同源策略，Web 世界就变得非常不安全，拿浏览器中的 cookie 来说，当你登录 A 网站，同时打开 B 网站，B 网站能获取你 A 网站的 cookie，盗取你的身份凭证进行非法操作。

同源策略只是一个规范，虽然并没有指定其具体的使用范围和实现方式，但各个浏览器厂商都针对同源策略做了自己的实现。

### 同源的定义

如果两个页面的协议（protocol），端口（port）和主机（host）都是相同的，则两个页面具有相同的源。

例如，相对于

```
http://www.example.com/dir/page.html
```

同源情况如下

| 地址 | 结果 |
| :---:| :----: |
| http://www.example.com/dir2/other.html | 同源 |
| http://v2.www.example.com/dir/other.html | 不同源（主机不同） |
| https://www.example.com/dir/other.html | 不同源（协议不同） |
| http://www.example.com:81/dir/other.html | 不同源（端口不同）|

### 限制范围

同源策略限制了不同源之间的交互，主要分成三类：

1. 通常允许跨域写操作。如链接、重定向和表单提交。
2. 通常允许特定的跨域资源嵌入。如 `script`、`img` 标签等。
3. 通常不允许跨域读操作。但常可以通过内嵌资源来巧妙的进行读取访问。

不受同源策略限制，可以通过跨域资源嵌入的方式访问的资源常见的有：

- `<script src="..."></script>` 标签嵌入跨域脚本
- `<link rel="stylesheet" href="...">` 标签嵌入CSS
- `<img>`，`<video>`，`<audio>` 标签嵌入图片、视频、音频资源
- `<object>`, `<embed>` 和 `<applet>` 标签嵌入插件
- @font-face 引入的字体。一些浏览器允许跨域字体（ cross-origin fonts），一些需要同源字体（same-origin fonts）。
- `<frame>` 和 `<iframe>` 载入的任何资源。站点可以使用X-Frame-Options消息头来阻止这种形式的跨域交互。

非同源的网站，常见的主要有以下几种行为受到限制：

1. 无法共享 Cookie, LocalStorage, IndexedDB
2. 无法操作彼此的 DOM 元素
3. 无法发送 Ajax 请求

### 跨域访问

同源策略做了很严格的限制，但在实际的场景中，又确实有很多地方需要突破同源策略的限制，也就是我们常说的跨域。实现跨域通信的解决方案有多种，我们可以简单的介绍几种方式。

#### 更改源

页面可以更改自己的源，但会受到一些限制。比如，可以使用 [document.domain](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/domain) 来设置子域的 `domain` 值，允许其安全访问其父域。例如：

可以在 `http://child.company.com/dir/a.html`中执行：

```javascript
document.domain = 'company.com'
```

页面将与 `http://company.com/dir/b.html` 处于相同的域。但是，试图给 `company.com` 设置 `document.domain` 为 `anotherCompany.com` 是不可行的，因为它不是 `company.com` 的父域。值得注意的是，浏览器的端口号是单独保存的，在给 `document.domain` 赋值时，如果不指明端口号，默认会以 null 值覆盖掉原来的端口号。因此 `company.com:8080` 不能仅通过设置 document.domain = "company.com" 来与 `company.com` 通信。必须在他们双方中都进行赋值，以确保端口号都为 null。

所以这种方法是有很大限制条件的，`document.domain` 这个值只能修改为这个页面的当前域或者当前域的超级域。所以，这个方法只能解决同一超级域下的页面跨域问题。

#### CORS

CORS（Cross-Origin Resource Sharing）是 W3C 提出的一个用于服务端控制数据跨域传输的一个机制。它的原理是给 HTTP 头增加特定的值，让服务端来定义允许来自哪些源的请求。这是一种最为常见的处理跨域 Ajax 请求的方式。

举例来说，当我们试图在 `example.com` 的页面向 `anotherexample.com` 的接口发起 Ajax 请求时：

```javascript
  let xhr = new XMLHttpRequest()
  let url = 'http://anotherexample.com/some/api/'

  xhr.open('GET', url, true)
  xhr.onreadystatechange = handler
  xhr.send()
```

在 `anotherexample.com` 的服务端没有进行任何设置的情况下，这个请求会因为跨域而失败。CORS 允许我们在请求头中设置 `Access-Control-Allow-Origin`，来控制允许哪些源的请求。我们可以用如下方式，设置允许所有的源。

```http
Access-Control-Allow-Origin: *
```

当然也可以直接设置成允许的域的名称，或者配合 Origin 请求头使用。

#### JSONP

JSONP 是 JSON with Padding 的简称，它的本质是利用内嵌的 `<script>` 资源不受同源政策影响，将接口需要返回的数据用指定名称的函数包裹起来进行传递，从而实现跨域接口请求。其基本原理可以简单描述如下：

客户端通过 script 标签发起跨域请求

```html
<script src="http://www.anotherexample.com/ajax?callback=myFunction"></script>
```

服务端接收 callback 参数，将数据用 callback 名称包裹返回，形如：

```javascript
myFunction({ foo: 'bar' })
```

客户端定义了 myFunction 函数，就会执行并拿到数据了：

```javascript
let mycallback = function (data){
  alert(data.foo)
}
```

实际使用的时候，不需要我们来实现这些繁琐的步骤，常见的第三方工具库如 JQuery，axios 等，都进行了封装，只需按照指定格式调用即可。需要注意，这种跨域方式需要后端的配合，因为后端的接口需要根据约定的参数获取回调函数名，然后跟返回数据进行拼接，最后进行响应。

#### window.postMessage

postMessage 是 HTML5 的一个接口，它主要用于跨域文档（如不同源的 iframe）间的通讯，它可以把纯文本消息从一个域发送到另外一个域，不受同源策略的限制。如，在 `example.com` 页面下试图向 iframe 中的 `otherexample.com` 发送消息：

```javascript
let targetWindow = document.getElementsByTagName('iframe')[0]
targetWindow.postMessage('Hello World!', 'http://otherexample.com')
```

在 otherexample.com 中监听 message 事件，进行处理：

```javascript
window.addEventListener('message', e => {
  let message = e.data
})
```

这种方式的适用场景有限，不能解决所有的跨域问题，且需要考虑浏览器的兼容性后再进行使用。

浏览器的同源策略是保证 Web 安全的重要法则，后续章节提到的客户端脚本攻击都与这一法则紧密相关，因此理解同源策略对我们构建安全可靠的 PWA 应用意义重大。
