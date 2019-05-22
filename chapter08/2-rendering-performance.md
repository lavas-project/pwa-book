# 渲染性能

在上文中，我们从多个角度讨论了如何优化页面加载性能。但一个用户体验良好的页面，不仅要快速加载，还需要有一系列流畅的交互。从而，这一节我们把目光投向页面渲染性能。

## 渲染流程

浏览器在渲染页面前，首先会将 HTML 文本内容解析为 DOM，将 CSS 解析为 CSSOM。DOM 和 CSSOM 都是树状数据结构，两者相互独立，但又有相似之处。DOM 树描述了 HTML 标签的属性，以及标签之间的嵌套关系，如 `<html>` 对象的子节点包含 `<head>` 和 `<body>` 对象，而 `<body>` 对象的子节点可能有 `<div>` 对象等。CSSOM 树与 DOM 树类似，但节点描述的是由 CSS 解析得到的选择器及其样式信息。

接着，浏览器会将 DOM 和 CSSOM 树合并成渲染树。从 DOM 树的根节点开始遍历，并在 CSSOM 树中查找节点对应的样式规则，合并成渲染树中的节点。在遍历的过程中，不可见的节点将会被忽略，如 `<script>`、`<link>` 等标签，以及样式中含有 `display: none` 的节点，但含有 `visibility: hidden` 的节点会被保留。这也是为什么后者仍会在页面中占据布局空间的原因。

渲染树随后会被用于布局，就是计算渲染树节点在浏览器视口中确切的位置和大小。布局的过程十分复杂。比如，一个普通的块级元素，其宽度会依赖于父元素的宽度，而高度则会依赖这个元素的内容。又比如，多个普通的块级元素，原本只会在页面中从上到下排列，但通过 Flexbox、浮动或定位，会改变元素布局的行为。显而易见，浏览器进行一次布局的性能开销较大，我们需要小心地避免频繁触发页面重新布局。

得到渲染树节点的几何布局信息后，浏览器就可以将节点绘制到屏幕上了，包括绘制文本、颜色、边框和阴影等。绘制的过程，非常简略地说，首先会根据布局和视觉相关的样式信息生成一系列绘制操作，随后执行栅格化（栅格化是将向量图形格式表示的图像转换成位图以用于显示器或者打印机输出的过程），将待绘制项转换为位图存储在 GPU 中，最终通过图形库将像素绘制在屏幕上。

页面不是一次性被绘制出来的。实际上，页面被分成了多个图层进行绘制，这些图层会在另一个单独的线程里绘制到屏幕上，这个过程被称作合成。合成线程可以对图层进行剪切、变换等处理，因此可以用于响应用户基本的滚动、缩放等操作，又不会受到主线程阻塞的影响。

到目前为止，在经历了构建 DOM 和 CSSOM、构建渲染树、布局、绘制、合成等多个步骤后，渲染的基本流程就结束了。但我们能通过 JavaScript 操作 DOM 或修改样式，这会导致渲染树的重新计算，浏览器可能需要对页面重新布局、重绘与合成。

## 关键渲染路径

通过上文的介绍，我们知道渲染树是由 DOM 和 CSSOM 组合而成的。因此，在 HTML 和 CSS 没有加载完成前，页面不会渲染任何内容。换句话说，HTML 和 CSS 都是会阻塞页面渲染的资源。除此之外，JavaScript 也会阻塞页面渲染。浏览器在解析 HTML 时，如果遇到 `<script>` 标签时，一般会暂停解析，直到 JavaScript 执行完毕后才会继续解析剩余的 HTML。对于外部 JavaScript，在执行前还需额外等待请求的时间。这些首屏渲染所必须的关键资源，共同组成了关键渲染路径。接下来，我们会讨论如何通过缩短关键渲染路径来优化首屏性能。

### 延迟非关键 CSS 加载

通过 `<link rel="stylesheet">` 引用的 CSS 都会在加载时阻塞页面渲染。但 Web 应用中往往会有一些首屏渲染时用不到的 CSS，如弹框的样式等。为了使这些非关键 CSS 不阻塞页面渲染，我们可以通过别的途径声明 CSS 的加载。

在上文 [加载性能](./1-loading-performance.md) 中提到，我们可以通过 `<link rel="preload">` 预加载我们所需的资源。这里仅需稍作改动，就能满足我们的要求。

```html
<!DOCTYPE HTML>
<html>
<head>
  <!-- ... -->
  <link rel="preload" as="style" href="/dist/index.css" onload="this.onload=null;this.rel='stylesheet'">
  <!-- ... -->
</head>
</html>
```

上面的例子非常直观，我们在 `<link rel="preload">` 中监听了 `onload` 事件，并在 CSS 加载完成后，通过修改 `rel` 为 `stylesheet` 来将 CSS 应用到页面上，这就绕过了 CSS 会阻塞页面渲染的限制了。在需要考虑浏览器兼容性的情况下，推荐使用 [loadCSS](<https://github.com/filamentgroup/loadCSS>) 来实现非关键 CSS 的加载。

对于首屏渲染所必须的关键 CSS，可以考虑通过 `<style>` 内联，或使用 HTTP/2 服务端推送的方式来加载，可以节省一次网络请求。这里不再进一步展开。

### async 和 defer

上文提到，页面中的 `<script>` 会阻塞后续 DOM 的构建。为了使 JavaScript 能与页面中所有的 DOM 进行交互，最常见的引入方式是将 `<script>` 置于 `<body>` 的最底部。

```html
<!DOCTYPE HTML>
<html>
<head>
  <!-- ... -->
</head>
<body>
  <!-- ... -->
  <script src="/dist/vendor.js"></script>
  <script src="/dist/app.js"></script>
</body>
</html>
```

绝大多数情况下，我们都不会使用如 `document.write()` 这样的方法，所以 `<script>` 在页面中的位置通常都是无关紧要的。另外，JavaScript 可能会修改样式，如果此时 CSSOM 树还未构建完成，则 JavaScript 的执行又会进一步被 CSS 加载所阻塞。针对这些弊端， `<script>` 提供了 `async` 和 `defer` 两个属性，它们的用法十分类似。

```html
<!DOCTYPE HTML>
<html>
<head>
  <!-- ... -->
  <script async src="/dist/vendor.js"></script>
  <script defer src="/dist/app.js"></script>
  <!-- ... -->
</head>
<body>
  <!-- ... -->
</body>
</html>
```

当浏览器解析到 `<script async>` 时，会对该 JavaScript 文件发起异步请求。请求成功后才会暂停 HTML 解析，并立即执行 JavaScript。在实际项目中容易发现，多个 `<script async>` 的执行顺序是不确定的。而且在 JavaScript 执行时，页面的 DOM 可能还未全部构建完成。

对于 `<script defer>` 来说，浏览器同样会发起异步请求，但 JavaScript 会延迟到 HTML 解析完毕后依次执行。此时 JavaScript 已经能和完整的 DOM 进行交互了。

两者各有千秋，选择 `<script async>` 还是 `<script defer>` 完全取决于我们的实际需求。

## 非阻塞 JavaScript

由于 JavaScript 一般是单线程执行的，长时间执行的任务会阻塞浏览器的主线程，使页面失去响应。当响应用户操作的时间超过 100ms 时，用户就已经能察觉到轻微的延迟和卡顿了。为了能在 100ms 内快速响应用户的操作，应尽量在 50ms 内处理事件。这是由于当前事件触发时，可能会有其他正在处理的事件，阻塞了当前事件的响应，造成页面卡顿。如果每个事件都在 50ms 内处理完，那么至多只需 100ms 就能响应用户的操作了。如果确实需要超过 50ms 才能处理完事件，就应该给用户提供执行进度的反馈。

同时，用户对于不流畅的滚动或动画十分敏感，一般要求页面帧率应达到每秒 60 帧。在这个帧率下，每帧的渲染需要在 16ms 内完成。但浏览器还需要花费大约 6ms 的时间将一帧绘制到屏幕上，从而只给我们留下了 10ms 时间生成一帧。由此可见，动画对于实时性要求比较苛刻，我们应该尽可能不在动画中进行其他计算。如果确实需要计算相关数据的，可以尝试将这些逻辑移到上文所述处理事件的 50ms 内进行预处理。

当页面无法及时响应用户操作，或者存在复杂和低效的动画时，最终都会严重影响用户体验。


### 页面滚动

最常见的动画是由用户触发的滚动操作。在移动 Web 应用中，当我们拖动屏幕时，页面一般会跟随手指进行滚动。但当我们监听 `touchstart`、`touchmove` 等事件时，由于合成线程并不知道我们是否会通过 `event.preventDefault()` 来阻止默认的滚动行为，从而在每次事件触发时，都会等待事件处理函数执行完毕后再进行页面滚动。这通常会导致较明显的延迟，影响页面滚动的流畅性。

```js
document.addEventListener('touchstart', handleTouchStart, {passive: true})
```

我们可以通过在 `addEventListener()` 时声明 `{passive: true}` ，来表明事件处理函数不会阻止页面滚动，使得用户的操作更快得到响应。

### requestAnimationFrame

JavaScript 可以进行样式更新，而动画则是以 16ms 为间隔的一连串的样式更新组成。最直接的想法是，可以通过 `setInterval()` 或递归调用 `setTimeout()` 来编写动画，如下代码所示。

```js
function render () {
  element.style.top = element.offsetTop + 1 + 'px'
  element.style.left = element.offsetLeft + 1 + 'px'
  setTimeout(render, 16)
}

setTimeout(render, 16)
```

上述代码实现了一个性能非常差劲的动画，其效果是使一个绝对定位的元素，从页面左上至右下漂浮。但我们用肉眼就能发现，动画产生了卡顿和掉帧的现象。这是由于 `setTimeout` 和 `setInterval` 的回调函数会在浏览器渲染两帧之间的任何时间点执行，而定时器的 16ms 又不是特别精确，从而有可能使一次样式变更错过浏览器渲染。

为了实现平滑流畅的动画效果，我们应该使用 `requestAnimationFrame()` 方法来代替定时器，`requestAnimationFrame()` 方法接收一个回调函数为参数，其回调函数不在浏览器事件循环中调度，而是在浏览器渲染下一帧之前执行，这可以确保动画不会掉帧。`requestAnimationFrame` 的回调函数接收一个高精度时间戳 `timestamp`，类似于 `performance.now()` 的返回值，代表回调被执行的精确时间，其用法通常如下代码所示。

```js
function render (timestamp) {
  // 执行渲染的具体逻辑
  // ...
  requestAnimationFrame(render)
}

requestAnimationFrame(render)
```

对于需要长时间执行的任务，我们可以尝试把它拆分成多个小任务，然后通过 `requestAnimationFrame()` 进行调度，以确保页面的流畅性。上文提到生成一帧的时间应该在 10ms 内，所以保守估计，帧间任务的执行时间最好不要超过 3 ~ 4ms，通常做法如下代码所示。

```js
function scheduleWork (timestamp) {
  let currentTimestamp
  while (currentTimestamp - timestamp < 4 && tasks.length > 0) {
    performWork(tasks.pop())
    currentTimestamp = performance.now()
  }
  tasks.length > 0 && requestAnimationFrame(scheduleWork)
}
```

### requestIdleCallback

 `requestIdleCallback` 允许我们将任务安排在浏览器空闲时执行。我们可以将一些不太重要的任务推迟，如发送日志等。`requestIdleCallback` 的回调函数接收一个参数 `deadline`，包含 `timeRemaining()` 方法和 `didTimeout` 属性。`timeRemaining()` 返回一个高精度时间戳，表示还剩多少时间执行任务。我们在上文反复提到，应该在 50ms 内处理事件，这对于 `requestIdleCallback` 来说也是一样的，所以 `timeRemaining()` 的初始值为 50ms。

```js
function scheduleWork (deadline) {
  while (deadline.timeRemaining() > 5 && tasks.length > 0) {
    performWork(tasks.pop())
  }
  tasks.length > 0 && requestIdleCallback(scheduleWork)
}

requestIdleCallback(scheduleWork)
```

上述代码与 `requestAnimationFrame` 中的例子十分相似。假设每个任务都能在 5ms 内完成，那么我们可以设定，当剩余空闲时间大于 5ms 时，继续处理剩余任务，否则就优先确保页面能及时响应用户操作，并将剩余的任务重新调度。

由于我们并不知道浏览器何时才会空闲，因此 `requestIdleCallback` 回调函数的执行时机是不确定的。但它提供了一个超时机制，能确保在等待超时后执行回调函数，此时 `timeRemaining()` 为 `0`，而 `didTimeout` 为 `true`。

```js
requestIdleCallback(scheduleWork, {timeout: 2000})
```

不过我们最好不要指定超时时间，因为这还是有可能导致页面无法及时响应用户操作。另外，由于不确定的执行时机，我们绝不应该在回调函数里操作 DOM，或进行任何样式变更，而应该放在 `requestAnimationFrame` 的回调函数中执行。

### Web Workers

对于需要长时间执行的任务，另一个解决方案是使用 Web Workers，在第四章介绍 Service Worker 的时候我们已经知道，Web Workers 是独立于主线程的独立工作线程，我们可以将一些耗性能的逻辑放在 worker 线程中进行处理，这样主线程就能继续响应用户操作和渲染页面了。在 Worker 线程中，我们无法访问主线程中的 DOM 或其他数据，仅能通过 `postMessage()` 与主线程进行数据通信。下面可以看一个最简单的 Web Workers 的示例，假设存在一个主线程入口 `main.js`，其内容如下：

```js
// main.js
const worker = new Worker('worker.js')

worker.addEventListener('message', event => console.log(event.data)) // 3

worker.postMessage([1, 2])
```

上面代码可以看出，通过 `new Worker('worker.js')` 的方式初始化了一个 worker 线程，和 Service Worker 一样，worker 线程执行的逻辑都会在 `worker.js` 中实现，下面代码展示的是 `worker.js` 的内容。

```js
// worker.js
self.addEventListener('message', event => {
  const {data} = event
  const sum = data[0] + data[1]

  self.postMessage(sum)
})
```
> 注意：
> 出于安全考虑，Chrome 不支持通过 file 协议加载 Web Worker，如果你想本地直接运行代码，需要在启动 Chrome 时加上参数 --allow-file-access-from-files，或者你可以使用 FireFox 进行调试，FireFox 目前没有此限制。

上述例子中，通过 Worker 线程计算了 `1 + 2` 的结果。这看起来没什么用，但却揭示了 Web Workers 最基本的用法。接下来我们可以再来看一些稍微复杂一点的例子。

```js
// main.js
const canvas = document.querySelector('canvas')
const offscreen = canvas.transferControlToOffscreen()
const worker = new Worker('worker.js')

worker.postMessage({canvas: offscreen}, [offscreen])
```

```js
// worker.js
self.addEventListener('message', event => {
  const {data: {canvas}} = event
  const context = canvas.getContext('2d')

  function render (time) {
    // ...
    self.requestAnimationFrame(render)
  }

  render()
})
```

这是一个离屏 canvas 的使用例子。我们把主线程中的 canvas 移动到了 Worker 线程，并在 Worker 线程中进行 canvas 的绘制。前一个例子没有提到的细节是，主线程与 Worker 线程之间，通过 `postMessage()` 传递数据的方式是“结构化克隆”。这是一种类似深拷贝的算法，用于拷贝结构化数据。但是，直接拷贝显然是低效的，尤其是在传递较大的数据时，性能开销令人难以接受。庆幸的是，实现 `Transferable` 接口的对象，如 `ArrayBuffer`、`ImageBitmap` 和 `OffscreenCanvas`，都支持移动语义。我们可以在 `postMessage()` 的第二个参数中声明数据应该移动到 Worker 线程，而不是拷贝。通过 `postMessage()` 移动后的数据，在原来的线程里就无法读取到了。

根据过往并发编程的经验，我们很容易会思考如何在 Web Workers 的多线程之间共享内存。`SharedArrayBuffer` 提供了共享内存的机制，在通过 `postMessage()` 传递数据时，不会进行结构化拷贝，而是在线程间共享相同的内存块。

```js
// main.js
const worker = new Worker('worker.js')
const length = 8
const size = Int32Array.BYTES_PER_ELEMENT * length
const sharedBuffer = new SharedArrayBuffer(size)
const sharedArray = new Int32Array(sharedBuffer)

worker.postMessage(sharedBuffer)
```

```js
// worker.js
self.addEventListener('message', event => {
  const {data: sharedBuffer} = event
  const sharedArray = new Int32Array(sharedBuffer)

  // ...
})
```

显然，共享内存可能会引发线程安全问题，即代码在多线程环境下，运行结果无法预测，且往往丢失了正确性。一个简单的思路是，确保数据始终只由一个线程来写入，而对于其他线程是只读的，但这样并没有解决本质问题。为了确保线程安全，JavaScript 提供了原子操作类 `Atomics` ，包含了读取、赋值、加减、位运算等原子操作。

```js
sharedArray[i]++ // 线程不安全

Atomics.add(sharedArray, i, 1) // 线程安全
```

原子操作表示最小不可分割的操作。上面是一个描述原子操作的经典例子。`sharedArray[i]++` 看似是一次递增操作，实际上包含了读取、修改与写入三步，而且写入的值依赖于先前读取的，这会引发线程安全问题，部分线程执行的递增操作可能丢失了。但使用原子操作 `Atomics.add()` 则是线程安全的，相当于将前者的三步操作合并成了一步，消除了多个线程之间的竞争态。

但并不是使用了原子操作的代码就是线程安全的，我们来看下面的例子。

```js
// main.js
const workers = Array.from(Array(4), () => new Worker('worker.js'))
const size = 2 * Uint8Array.BYTES_PER_ELEMENT
const cache = new SharedArrayBuffer(size)

workers.forEach((worker, index) => worker.addEventListener('message', event => {
  const {data: {num, factorial}} = event

  let target = 1

  for (let i = 2; i <= num; i++) {
    target *= i;
  }

  if (factorial !== target) {
    console.log('Not thread safe:')
  }

  console.log(`${num}! = ${factorial}`)
}))

const nums = Array.from(Array(128), () => Math.ceil(Math.random() * 5))

nums.forEach((num, index) => {
  workers[index & 3].postMessage({
    num,
    cache
  })
})

```

```js
// worker.js
self.addEventListener('message', event => {
  const {data: {num, cache}} = event
  const lastResult = new Uint8Array(cache)

  if (Atomics.load(lastResult, 0) === num) {
    return self.postMessage({
      num,
      factorial: Atomics.load(lastResult, 1)
    })
  }

  let factorial = 1

  for (let i = 2; i <= num; i++) {
    factorial *= i
  }

  Atomics.store(lastResult, 0, num)
  Atomics.store(lastResult, 1, factorial)
  self.postMessage({num, factorial})
})
```

上述代码是一个刻意构造的例子，将 128 个大小为 1~5 的数字分配给四个 Worker 线程计算阶乘，并将最近一次计算的结果缓存在共享内存 `cache` 里。虽然对 `cache` 的所有操作均为原子操作，但我们经过简单思考后就能发现，这段代码仍然不是线程安全的。因为我们不能保证两次读取 `lastResult` 之间，其他线程没有对其进行修改。同样，我们也不能保证能同时写入 `lastResult` 的两个值。

对于单个共享变量而言，`Atomics.compareExchange` 提供了一种乐观锁的机制，可以仅在当前值符合预期时才进行写入。但对于多个共享变量的同步，我们通常需要使用互斥锁。注意到 `Atomics.wait()` 和 `Atomics.notify()` 的用法类似于 Linux 的 futex，我们可以利用这两个方法，实现一个简单的互斥锁。

```js
class Mutex {
  constructor (resources, index) {
    this.resources = resources
    this.index = index
    this.locked = false
  }

  lock () {
    if (this.locked) {
      Atomics.add(this.resources, this.index, 1)
      return
    }
    while (1) {
      if (Atomics.load(this.resources, this.index) > 0) {
        while (Atomics.wait(this.resources, this.index, 0) !== 'ok') {}
      }
      if (Atomics.compareExchange(this.resources, this.index, 0, 1)) {
        continue
      }
      this.locked = true
      return
    }
  }

  unlock () {
    if (!this.locked) {
      return
    }
    if (Atomics.sub(this.resources, this.index, 1) === 1) {
      this.locked = false
    }
    Atomics.notify(this.resources, this.index, 1)
  }
}
```

`resources` 在多线程中共享，用 `resources[index]` 表示 `index` 处被锁定的次数。通过 `lock()` 请求互斥锁时，会使用 `Atomics.wait()` 等待其他线程释放 `index` 处的锁。类似的，通过 `unlock()` 释放互斥锁时，会使用 `Atomics.notify()` 通知其他线程该处的锁已被释放。

## 降低渲染树计算复杂性

如上文提到的，渲染树由 DOM 和 CSSOM 树合并而成，对于每个 DOM 元素，需要查找与元素匹配的样式规则。从而，在尽量减少 DOM 元素节点的情况下，使用简单的 CSS 选择器是一个很自然的想法。

```css
.last-list-item {
  /* ... */
}
ul.list > li:last-child {
  /* ... */
}
```

在上面的例子中，使用一个类作为选择器，要比多种选择器混合使用简单得多。浏览器对于后者，需要花费更多的时间判断选择器与元素是否匹配。只在 CSS 中使用类选择器，并对类名使用 BEM (Block, Element, Modifier) 命名法，是一种组织 CSS 代码的好方式。类名由块、元素、修饰符三部分组成，如上面描述列表中最后一个元素的 BEM 命名法，可以命名为 `.list__list-item--last-child`。使用 CSS Modules 可以更方便地达到类似的效果。CSS Modules 是一种较为主流的 CSS-in-JS 解决方案，利用 webpack 等构建工具，可以对类选择器生成自定义格式的唯一类名，同样能减少浏览器匹配 CSS 选择器的开销。

## 减少布局次数

页面布局与元素样式的几何特性相关，对应的 CSS 属性包括盒模型、定位等。修改这些属性会引起一次页面重新布局，又被称作回流。上文提到，浏览器进行一次布局的开销很大，所以我们需要尽可能避免直接修改这些属性，尤其是不应将布局属性用于动画效果，否则会出现明显的掉帧现象。关于如何使用 CSS 编写高性能的动画，会在下一小节里详细讨论。

通过 JavaScript 触发页面布局时，容易造成多种性能问题，其中最常见的是 forced reflow（强制重新布局）。

```js
const box = document.querySelector('.box')
let domRect = null

function getBoxClientRect () {
  domRect = box.getBoundingClientRect()
}

requestAnimationFrame(getBoxClientRect)
```

我们在下一帧开始前通过 `getBoundingClientRect()` 获取元素的宽高及视口位置，获取的其实是上一帧已经计算好的布局信息。但如果在这之前又修改了元素的布局属性，那么为了获取当前正确的布局信息，浏览器只能被迫触发一次重新布局。如下面的代码所示：

```js
const box = document.querySelector('.box')
let domRect = null

function getBoxClientRect () {
  box.style.width = '360px'
  domRect = box.getBoundingClientRect() // forced reflow
}

requestAnimationFrame(getBoxClientRect)
```

但如果我们交换上述写和读的操作，就不会触发重新布局。这是由于浏览器并不会在修改元素布局属性后直接重新布局，而是会将所有修改操作合并，在后续一帧的布局中统一处理。简单来说，始终保持布局属性先读后写，可以有效回避这个性能问题。

我们明白了强制重新布局的原理后，可以再来看一种原理相同但较为隐蔽的性能问题，被为作布局抖动。

```js
const boxes = [...document.querySelectorAll('.box')]

boxes.forEach((box) => {
  const domRect = box.getBoundingClientRect()

  box.style.width = domRect.width + 10 + 'px'
})
```

上面的例子试图将所有 `.box` 元素宽度增加 `10px` 。看似保持了对布局属性的先读后写，实际上浏览器快速而连续地进行了大量重新布局。这是由于在下一次 `forEach()` 迭代中，通过 `getBoundingClientRect()` 获取元素的布局信息时，必须考虑上一次迭代中修改 `box.style.width` 可能造成的影响。从而浏览器只能在每次迭代中都触发一次重新布局，造成布局抖动的现象。

```js
const boxes = [...document.querySelectorAll('.box')]
const domRects = boxes.map(box => box.getBoundingClientRect())

boxes.forEach((box, index) => {
  box.style.width = domRects[index].width + 10 + 'px'
})
```

调整元素布局属性的读写顺序，可轻易地解决布局抖动问题。只需确保布局属性先批量读取，再批量写入即可。

## 优化绘制与合成

类似对布局操作的优化，这一小节我们关注如何减少重绘。上文提到，修改元素几何形态相关的样式属性，才会触发页面重新布局。但对于绘制来说，我们能很直观地想到，修改绝大多数样式属性都会导致页面重绘，这很难避免。仅有的例外是 `transform` 和 `opacity`，这是由于它们可以仅由合成器操作图层来实现。另外，合成器运行在单独的线程里，即使浏览器主线程被阻塞，其效果也不会受到影响。所以，`transform` 和 `opacity` 非常适合用于实现动画效果，但我们仍需要通过 `will-change` 为它们创建独立的图层，避免影响其他图层的绘制。

```css
.moving-element {
  will-change: transform, opacity;
}
```
