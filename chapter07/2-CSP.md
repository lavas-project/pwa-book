## 内容安全策略

CSP（Content Security Policy）即内容安全策略，主要目标是减少、并有效报告 XSS 攻击，其实质就是让开发者定制一份白名单，告诉浏览器允许加载、执行的外部资源。即使攻击者能够发现可从中注入脚本的漏洞，由于脚本不在白名单之列，浏览器也不会执行该脚本，从而降低客户端遭受 XSS 攻击风险。

默认配置下，CSP 甚至不允许执行内联代码 (`<script>` 块内容，内联事件，内联样式)，以及禁止执行`eval()`, `setTimeout` 和 `setInterval`。为什么要这么做呢？因为制定来源白名单依旧无法解决 XSS 攻击的最大威胁：内联脚本注入。浏览器无法区分合法内联脚本与恶意注入的脚本，所以通过默认禁止内联脚本来有效解决这个问题。事实上我们并不推荐使用内联脚本混合的开发方式，使用外部资源，浏览器更容易缓存，对开发者也容易阅读理解，并且有助于编译和压缩。当然，如果不得不需要内联脚本和样式，可以通过设置 `unsafe-inline`，来解除这一限制。

CSP 提供了一系列的属性配置，从而实现精确地控制浏览器的资源加载行为。开发者只需要将特定的属性，组合成一条有效的安全策略字符串 policy，然后指定 Content-Security-Policy 头部即可使用，如：

```http
Content-Security-Policy: policy
```

[caniuse](http://caniuse.com/#search=CSP) 提供了目前浏览器对 CSP 的支持情况，对于不支持 CSP 的浏览器以及未提供 CSP 头部的站点，将默认为网页内容使用标准的浏览器同源策略。

### 启用 CSP

有两种方法配置并启用 CSP

1.设置 HTTP 头的 Content-Security-Policy 字段（旧版 X-Content-Security-Policy）

```http
Content-Security-Policy: script-src 'self'; object-src 'none';style-src cdn.example.org third-party.org; child-src https://other.com
```

2.设置页面的 `<meta>` 标签

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; style-src cdn.example.org third-party.org; child-src https://other.com">
```

这两种不同的方式制定了同一个 CSP 策略，该策略对资源的加载进行了一些限制，设置了 script-src: 'self'，只信任当前域名下的脚本，同时使用 object-src: 'none'，不允许加载任何插件资源（如object, embed, applet 等标签引入的 flash 等插件），再使用 style-src 属性限制样式文件只能来自 `cdn.example.org` 和 `third-party.org`，此外还用 child-src 限定 iframe 的来源必须是 `https://other.com`。

除了上述例子使用的属性之外，CSP 提供了很多可配置的选项来针对不同资源的加载进行限制，常见的有，

- child-src：限制 iframe 及 worker 线程的来源，替代已弃用的 frame-src
- connect-src：限制 XHR、WebSockets 和 EventSource 连接的来源
- font-src：指定字体文件的来源
- img-src：限定图像来源
- media-src：限定媒体文件（音频和视频）的来源
- object-src：插件（比如 Flash）来源
- report-uri：用于指定在违反策略时浏览器发送报告的地址。此指令不能用于 <meta> 标记。
- script-src：限定脚本的来源
- style-src：样式表
- manifest-src：manifest 文件

每个配置项的源列表是一个字符串，指定了一个或多个主机（使用域名或 IP 地址）、协议和端口号。站点地址和端口号都可以使用通配符前缀 `*` 来表明所有合法端口都是有效来源。我们可以举几个例子来说明：

```
http://*.example.com
```

匹配所有使用 http 协议加载 `example.com` 的子域名。

```
mail.example.com:443
```

匹配所有访问 `mail.example.com` 的 443 端口的源。

```
https://store.example.com
```

匹配 `store.example.com` 下所有使用 HTTPS 协议的资源。

注意，如果端口号没有被指定，浏览器会使用指定协议的默认端口号。如果协议没有被指定，浏览器会使用访问该文档时的协议。除此之外，还有一些关键字的选项：

- 关键字 'self'：当前域名，需要加引号
- 关键字 'none'：禁止加载任何外部资源，需要加引号

如果不为某条配置设置具体的值，则默认情况下，该配置在运行时认为你指定 `*` 作为有效来源（例如，你可以从任意位置加载字体，没有任何限制）。也可以设置 `default-src` 的值，来代替各个选项的默认值。例如，如果我们将 `default-src` 设为 `https://example.com`，并且没有指定 `font-src` 的值，那么站点将只允许加载来自 `https://example.com` 的字体。不过也有一些选项不使用 `default-src` 作为默认回退值，也就是说，不进行设置的话就会加载任何内容。比如：

- base-uri
- form-action
- frame-ancestors
- plugin-types
- report-uri
- sandbox

这里对 CSP 的属性内容作了比较全面的介绍：[https://www.w3.org/TR/CSP/](https://www.w3.org/TR/CSP/)，值得一提的是，使用 CSP 时需要考虑到兼容性问题，兼容性的情况可参阅：[https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CSP#浏览器兼容性](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CSP#%E6%B5%8F%E8%A7%88%E5%99%A8%E5%85%BC%E5%AE%B9%E6%80%A7)。

### 发送报告

默认情况下，违背 CSP 策略的站点并不会发送报告。我们可以指定 `report-uri` 属性，并提供至少一个 URI 地址去递交报告：

```http
Content-Security-Policy: default-src 'self'; report-uri https://yourwebsite.com/csp/report
```

报告请求将以 POST 的形式发送，包含的 JSON 格式数据有以下字段：

- document-uri：发生违规的文档的 URI。
- referrer：违规发生处的文档引用（地址）。
- blocked-uri：被 CSP 阻止的资源 URI。如果被阻止的 URI 来自不同的源而非文档 URI，那么被阻止的资源 URI 会被删减，仅保留协议，主机和端口号。
- violated-directive：违反的策略名称。
- original-policy：在 Content-Security-Policy HTTP 头部中指明的原始策略。

值得注意的是，`report-uri` 不能在 meta 中设置，需要在请求头中指定才会生效。此外，如果我们只想对当前网站做一个测试，仅发送不符合 CSP 策略的报告，而不强制执行限制，可以设置 `Content-Security-Policy-Report-Only` 请求头代替 `Content-Security-Policy`，如下：

```http
Content-Security-Policy-Report-Only: default-src 'self'; ...; report-uri https://yourwebsite.com/csp/report;
```