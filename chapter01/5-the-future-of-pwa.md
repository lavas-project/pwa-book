# PWA 的未来

从 Google 最初提出 PWA 到现在，PWA 已经有不小的改变了，这就是 Web 的魅力，遵循标准且完全开放的魅力，来自世界各地的开发者参与标准的制定，它还在不断进化，Web 即使已经 30 岁了，它还依旧是被广泛应用的技术之一。

关注 Web 标准化的开发者会在标准文档里发现很多有意思的提案，有 Web 蓝牙、Web XR 等，在 [TPAC Lyon 2018](https://www.w3.org/2018/10/TPAC/) 上，Intel 的开发者演示了他们开发的 Web Machine Learning 的 DEMO，Web 也能直接利用 NPU 来进行深度学习的计算，让我觉得 Web 还能再战 30 年，我对此充满信心。

在国外，PWA 已经被广泛应用，也被用户所接受。在笔者刚从事 Web 生态相关工作的时候，国内才刚刚接触到 PWA 这个概念，UC 浏览器的内核版本还是 Chrome 3x，连 ES6 都支持的不全，更别说是 Service Worker、Web App Manifest 等 PWA 技术了。UC 浏览器并不是个例，国内厂商 App 内核版本几乎都不支持 Service Worker。不过也就在不到一年的时间里，这些浏览器就都支持了 Service Worker，让人不得不感叹国内互联网进步之快，国内主流浏览器对 Service Worker 的支持度如下图所示。

![Service Worker 的支持度](./img/is_service_worker_ready.png)

除了 Service Worker 等主流 PWA 技术外，W3C 也一直在推进 Device API 的标准。在 MDN，有一个 Web API 的索引，[WebAPI](https://developer.mozilla.org/zh-CN/docs/WebAPI)，里面列出了大部分的现存的 Device API 和其他的 API。

[Accelerated Shape Detection in Imagges](https://wicg.github.io/shape-detection-api/) 是形体检测的 API，在最新的 Chrome 中已经支持，如下代码所示。

> 需要将 chrome://flags/#enable-experimental-web-platform-features 设置为 Enabled。

```javascript
// 人脸识别
const faceDetector = new FaceDetector({fastMode: true, maxDetectedFaces: 1})

// 假设 theImage 是 <img> 标签中的内容或者一个 Blob 对象
faceDetector.detect(theImage)
  .then(detectedFaces => {
    for (const face of detectedFaces) {
      console.log(
        ` Face @ (${face.boundingBox.x}, ${face.boundingBox.y}),` +
        ` size ${face.boundingBox.width}x${face.boundingBox.height}`);
    }
  }).catch(() => {
    console.error("Face Detection failed, boo.");
  })
```

不断有新的 Device API 被支持，W3C 等标准组织有一群对 Web 怀抱希望，希望 Web 成为开放技术的人，他们在努力推进 Web 用户体验的提升，虽然由于 W3C 的组织方式和对安全、隐私、性能的考虑，推进速度不是很快，但不久也会被所有浏览器支持。我喜欢 Web 的开放，喜欢它的简单。
