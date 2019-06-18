# Promise

在深入介绍 Service Worker 之前，先来了解一下 Promise API。因为 Service Worker 的所有的异步接口内部都采用 Promise 来实现，因此学习了 Promise 讲能够有助于对 Service Worker 的理解。此外，本文还介绍了 Promise
的可靠性，链式调用的原理，并行执行的原理等较为深入的内容，感兴趣的读者也可以通过本文加深对 Promise 的理解。

## 什么是 Promise

Promise 是 ES6 引入的一种异步编程的解决方案，通过 Promise 对象来提供统一的异步状态管理方法。

过去我们通常使用注册异步回调函数的形式来进行异步编程，这里的异步回调实际上是具体的异步函数与开发者的接口约定，并不存在任何的标准，因此回调的注册形式、触发方式、异步状态管理等等都得不到统一且稳定的保证。同时这种异步回调的写法不利于状态管理，在处理多个异步过程的时候容易走进回调地狱，因此 JavaScript 异步编程需要一个统一且可靠的方案来进行异步状态管理，因此 Promise 应运而生。事实上 Promise 是社区推动的产物，在早期就出现了比如 $.Deferred、Blubird 等库用于解决异步状态管理和回调地狱的问题，并最终促进并推动了 Promise 写进了 ES6 规范当中。

## Promise 基本用法

一般在使用 Promise 对象的时候，首先需要对其进行实例化：

```js
let promise = new Promise((resolve, reject) => {
  if (/* 异步操作成功 */) {
    resolve(value)
  } else {
    reject(error)
  }
})
```

其中实例化的 promise 对象为异步状态的管理容器，`resolve()` 和 `reject()` 则是用于控制 promise 状态的方法。

Promise 具有三种状态：

- 'pending'：初始状态，代表异步过程仍在进行中，尚未判定成功或者失败；
- 'fulfilled'：异步操作成功。通过调用 `resolve()` 方法，promise 状态将由 'pending' 变更为 'fulfilled'；
- 'rejected'：异步操作失败。通过调用 `reject()` 方法，promise 状态将变更为 'rejected'。

在调用 `resolve()` 或 `reject()` 方法的时候可以传入任意值，比如 `resolve('操作成功')`、`reject(Error('操作失败'))` 等等，这个值会作为监听状态变更的回调函数的参数透传出去。

Promise 提供了 `.then(onFulfilled, onRejected)` 和 `.catch(onRejected)` 等原型链方法用于注册状态变更所触发的回调函数。其中 `.catch(onRejected)` 等价于 `.then(value => value, onRejected)`，因此为了行文方便，在没有特殊说明的情况下，后续所提到的 `.then()` 方法均用于指代 `.then()` 或 `.catch()`。

下面的示例演示了 Promise 的基本使用方式。在这个例子中创建了一个 Promise 对象，并且利用 `setTimeout()` 方法在 1 秒后触发 Promise 的状态变更，状态变更后便会触发 `onFulfilled` 回调函数并在控制台打印出 Promise 的返回值。

```js
let promise = new Promise(resolve => {
  setTimeout(() => {
    resolve('执行完成！')
  }, 1000)
})
// 1 秒后打印“执行完成”
promise.then(value => {
  console.log(value)
})
// 此时不会执行 onRejected 回调
promise.catch(error => {
  console.log(error)
})
```

同理，1 秒后将 Promise 状态变更为失败则是调用 `reject()` 方法，可采用 `.then()` 和 `.catch()` 方法进行 onRejected 回调的注册：

```js
let promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject('操作失败！')
  }, 1000)
})
promise.then(
  // 不会进入 onFulfilled 回调
  value => {
    console.log(value)
  },
  // 1 秒后打印“操作失败！[1]”
  error => {
    console.log(error + '[1]')
  }
)
// 1 秒后打印“操作失败！[2]”
promise.catch(error => {
  console.log(error + '[2]')
})
```

当回调函数执行出错时，promise 的状态同样会变更为 'rejected'：

```js
let promise = new Promise((resolve, reject) => {
  throw Error('操作失败！')
})
promise.catch(error => {
  // 打印“操作失败！”
  console.log(error.message)
})
```

在一些复杂的异步场景当中，我们还可以使用变量将 resolve 和 reject 缓存下来，等到需要变更 promise 状态的时候再去触发它们，这种情形在配合上各种闭包写法，可以实现很多神奇的功能：

```js
let resolve
let reject

let promise = new Promise((res, rej) => {
  resolve = res
  reject = rej
})

promise.then(value => {
  console.log(value)
})

/* 一些神仙操作 */
if (/* 异步操作成功 */) {
  resolve(value)
} else {
  reject(error)
}
```

Promise 提供了 `Promise.resolve(value)` 和 `Promise.reject(error)` 来快速获得一个确定状态以及返回值的 Promise 对象，在一些特定的使用场景下，这两个函数能够起到简化代码的作用。

```js
let p1 = Promise.resolve(12345)
// 等价于
let p1 = new Promise(resolve => {
  resolve(12345)
})

let p2 = Promise.reject(Error('出错了'))
// 等价于
let p2 = new Promise((resolve, reject) => {
  reject(Error('出错了'))
})
```

## Promise 的可靠性

Promise 作为异步状态的管理方案，首先要解决的是状态管理的可靠性问题，这里包括操作的可靠性和状态的可靠性两个方面，Promise 通过以下特点来依次解决这些可靠性问题。

### 统一的格式

Promise 对象统一了异步状态管理的格式，经过 Promise 包装的异步过程将具有统一的状态变更方式，统一的 API 以及统一的回调函数格式。这样就再也不需要为过去不同形式的回调函数所困扰。

我们可以做个对比，在过去采用回调函数的机制进行异步编程时，写法五花八门：

```js
// ajax 风格的回调写法
run({
  success (value) {
    console.log('执行成功！')
  },
  error (error) {
    console.log('执行失败！')
  }
})
// nodejs 风格的回调写法
run((error, result) => {
  if (error) {
    console.log('执行失败！')
  } else {
    console.log('执行成功！')
  }
})
// 事件监听风格的回调写法
run.onsuccess = (result) => {
  console.log('执行成功！')
}
run.onfail = (error) => {
  console.log('执行失败！')
}
run()
```

而 Promise 只有一种写法，完成了格式上的统一，这也为下一节将要介绍的 Promise 链式调用提供基础：

```js
let promise = run()
promise.then(result => {
  console.log('执行成功！')
})
promise.catch(result => {
  console.log('执行失败！')
})
```

### Promise 状态不受外部影响

Promise 只能通过 `resolve()` 和 `reject()` 方法控制 Promise 的状态，这个状态无法被外部直接访问，也没有提供任何方法从外部修改状态，这就保证了 Promise 状态不受外部影响。

### Promise 状态具有确定性

Promise 对象一旦从初始状态（pending）变更为执行成功（fulfilled）或者执行失败（rejected），那么这个状态就被完全确定下来了，不会被后续的任何操作所影响，即便在此后多次调用 `resolve()` 或 `reject()`，这个 Promise 对象的状态也将永远是这个初次变更时的状态。同时，初次调用 `resolve` 或者 `reject` 所传入的参数也将会固定下来。

```js
let promise = new Promise((resolve, reject) => {
  // 初次触发状态变更为 fulfilled,
  // 同时记录返回值为 1 并触发 onFulfilled 回调函数
  resolve(1)
  // 后续的操作都不会影响状态，
  // 也不会覆盖掉返回值，
  // 也不会多次触发 onFulfilled 回调
  reject(2)
  resolve(3)
  reject(4)
})
// 打印 1
promise.then(value => {
  console.log(value)
})
// 不会进入该 onRejected 回调
promise.catch(error => {
  console.log(error)
})
```

Promise 的这一特性确保了异步过程最终状态的确定性，不用担心这个状态在后续的任何时候发生变更。

### Promise 回调函数是一次性的

由于 Promise 对象上注册的回调函数只会至多触发一次，这个特点规避了过去基于基于回调函数的异步编程当中回调函数执行次数不受控制的问题。在 Promise 的这套机制下，希望触发几次回调，就注册几个回调函数即可。

```js
// 假设异步函数的实现机制如下，会存在多次调用 callback 的情况
function run (callback) {
  setInterval(callback, 1000)
}
// 采用 Promise 进行包装，就能够避免这一问题
let promise = new Promise(resolve => {
  run(resolve)
})

// 只会触发一次
promise.then(() => {
  console.log('执行完成！')
})
```

### Promise 不存在回调过早问题

由于 Promise 的状态具有确定性，一旦固定下来后便不会发生任何更改，因此在任何时候注册回调函数都可以监听到 Promise 的状态。如果回调函数在状态变更前注册，则会等待状态变更时触发；当注册时状态已经确定下来，那么 Promise
会立即调用这个函数并传入相应的返回值。这就解决了过去回调函数机制可能存在的回调过早问题（即事件在回调注册前触发导致回调监听失效），在 Promise 机制的保证下，这种问题不会发生。

下面举个例子演示后注册的 onFulfilled 回调获取返回值的情况：

```js
let promise = new Promise((resolve, reject) => {
  // 1 秒时触发状态变更为 fulfilled
  setTimeout(() => {
    resolve('操作成功！')
  }, 1000)
})
// 0 秒时注册 onFulfilled
promise.then(value => {
    console.log(value + '[1]')
})
// 2 秒时注册 onFulfilled
setTimeout(() => {
  promise.then(value => {
    console.log(value + '[2]')
  })
}, 2000)
```

这段代码的控制台输出结果为：

```bash
# (...1s)
操作成功！[1]
# (...2s)
操作成功！[2]
```

可以看到，第 0 秒注册的回调函数在第 1 秒 promise 对象状态变更的时候触发，同时第 2 秒注册的的回调函数会立即触发并成功获得返回值。

这一特性确保了在任何时候注册 promise 的回调函数都不会错过异步返回的结果，这个点在回调函数的年代很难被保证的。

### Promise 的回调函数之间不会相互影响

同一个 Promise 上注册的回调函数彼此相互隔离，因此个别回调函数执行出错并不会影响到其他回调函数的正常执行。

```js
let promise = new Promise(resolve => {
  setTimeout(() => {
    resolve('操作成功！')
  }, 1000)
})

// 1 秒后执行回调并抛错
promise.then(value => {
  throw Error('出错了')
})

// 永远不会进到 onRejected 回调中
// 因为onFulfilled 执行出错不会影响 promise 的状态
promise.catch(error => {
  console.log(error)
})

// 1 秒后打印“操作成功！”
promise.then(value => {
  console.log(value)
})
```

### Promise 回调函数执行的时序是确定的

首先举个例子来说明问题。假设目前存在一个函数 `run()`，它可以传入回调函数作为参数，那么相应的代码如下所示：

```js
console.log('a')
run(() => {
  console.log('b')
})
console.log('c')
```

在不知道 run 函数的内部实现之前，我们完全无法预测这段代码的执行结果。比如以下这两种实现方式，其打印的结果是完全不一样的：

```js
function run (callback) {
  callback()
}
// 打印 a b c

/*****/

function run (callback) {
  setTimeout(callback)
}
// 打印 a c b
```

但如果 run 函数通过 Promise 的方式来实现，并且回调函数放到 `.then` 方法当中执行，那么我们就可以很明显地知道打印结果一定是“a c b”：

```js
console.log('a')
run().then(() => {
  console.log('b')
})
console.log('c')
// 打印 a c b
```

这里涉及到 microtask、JavaScript 事件循环机制相关 的概念，感兴趣的同学可以搜索相应关键字进行深入了解。

### 小节

总的来说，Promise 通过一系列特性解决了过去异步编程当中存在的可靠性问题，使得我们能够以一种更为简单而规整的方式去获取和管理异步状态。

## Promise 的串行执行与链式调用

在开篇 Promise 的演示当中一个最为亮眼的特点就是，通过一连串的 `.then()` 链式调用来实现多个异步方法的顺序执行问题：

```js
run1()
  .then(run2)
  .then(run3)
  .then(run4)
  .catch(error => {
    console.log('执行出错')
  })
```

那么接下来我们将从 `.then()` 出发，一步一步地弄明白其中的 Promise 传递过程，并最终理解 Promise 的链式调用机制。

### Promise.prototype.then

`.then(onFulfilled, onRejected)` 是 Promise 的原型链方法，用于注册 Promise 对象状态变更时的回调函数。它接受两个回调函数作为参数，分别在 Promise 变更为不同状态时触发，其中 `onRejected` 可以缺省。

```js
promise.then(
  result => {
    console.log('执行成功！')
  },
  error => {
    console.log('执行失败！')
  }
)
```

`.then()` 方法会返回一个 Promise 对象，用于表征回调函数的执行情况。这个 Promise 对象满足以下规则：

1. 当回调函数返回 Promise 对象时，这个 Promise 对象就是 `.then()` 方法所返回的 Promise；
2. 当回调函数返回其他的结果，甚至返回 undefined 时，`.then()` 方法将会返回 `Promise.resolve(value)` 所创建的 Promise 对象；
3. 当回调函数抛出异常时，`.then()` 方法则会将异常值捕获并返回 `Promise.reject(error)` 所创建的 Promise 对象。


下面通过一些例子来说明 `.then()` 方法在不同情况下的执行结果。

#### 4. 回调函数返回 Promise 对象

```js
// 初始 Promise 对象，2 秒后执行成功并返回 '[p1]'
let p1 = new Promise(resolve => {
  setTimeout(() => {
    resolve('[p1]')
  }, 2000)
})
// 用于缓存 p1 回调函数中创建的 Promise 对象用于与 p3 比对
let p2

let p3 = p1.then(result => {
  p2 = new Promise(resolve => {
    setTimeout(() => {
      resolve('[p2]')
    }, 1000)
  })
  return p2
})

// 打印 true
// 证明回调函数返回的 Promise 对象会作为 .then() 函数的返回值
console.log(p3 === p2)

// 3 秒后打印 '[p2]'
p3.then(result => {
  console.log(result)
})
```

通过这个机制，就能够实现多个异步过程的顺序执行，只需要将所有的异步过程统一使用 Promise 进行包裹，并且将下一个异步过程的 Promise 对象作为上一个异步过程 Promise 对象的 `onFulfilled` 回调函数的返回值即可。

#### 1. 正常顺序执行

```js
// 获取初始 promise 对象
let promise = new Promise(resolve => {
  setTimeout(() => {
    resolve('执行成功！')
  }, 1000)
})
// onFulfilled 回调执行完成
// 因此 p1 状态变更为 'fulfilled'
let p1 = promise.then(result => {
  return result + '[1]'
})
// 1 秒后打印“执行成功！[1]”
let p2 = p1.then(result => {
  console.log(result)
})
```

#### 2. 错误处理

```js
// 获取初始 promise 对象
let promise = new Promise(resolve => {
  // 1 秒后触发执行失败
  setTimeout(() => {
    reject('执行失败！')
  }, 1000)
})
// 1 秒后打印“执行失败”
// 同时由于 onRejected 回调执行完成
// p1 状态变更为 'fulfilled'
let p1 = promise.catch(error => {
  console.log(error)
})
// 打印 undefined，因为 p1 注册的回调没有任何返回
let p2 = p1.then(value => {
  console.log(value)
})
```

#### 3. 执行回调时抛出异常

```js
// 获取初始 promise 对象
let promise = new Promise(resolve => {
  // 1 秒后触发执行成功
  setTimeout(() => {
    resolve('执行成功！')
  }, 1000)
})
// 1 秒后执行回调并抛出异常
// 此时 p1 状态变更为 'rejected'
let p1 = promise.then(value => {
  throw Error('执行异常！')
})
// 打印“执行异常！”并返回字符串
// 由于该回调执行完成因此 p2 状态变更为 'fulfilled'
let p2 = p1.catch(error => {
  console.log(error.message)
  return '恢复正常！'
})
// 打印“恢复正常！”
// 同时 p3 状态变更为 'fulfilled'
let p3 = p2.then(value => {
  console.log(value)
})
```

### Promise 的链式调用

通过前面的举例可以看到 `.then()` 方法是 Promise 对象的原型链方法，并且其返回值同样也是个 Promise 对象，因此只要把前面例子中一些无关紧要的中间变量去除掉，就实现 Promise 的链式调用了。

```js
new Promise(resolve => {
  setTimeout(() => {
    resolve('执行成功！')
  }, 1000)
})
.then(result => {
  console.log('步骤 [1]')
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(Error('执行异常'))
    }, 1000)
  })
})
.catch(error => {
  console.log(error.message)
  return '恢复正常'
})
.then(result => {
  console.log(result)
})
```

链式调用的好处就是，可以非常直观地将多个需要按顺序执行的异步过程以一种自上而下的线性组合方式实现，在降低编码难度的同时，也增加了代码的可读性。

同时基于注册在同一 Promise 对象的回调函数彼此不相干扰的特性，我们可以在任何需要的地方进行链分叉。在下面的例子当中，假设对于初始 Promise 对象的不同状态将采取两种完全不一样的异步操作的时候，就可以这么实现：

```js
let p1 = new Promise((resolve, reject) => {
  if (Math.random() > 0.5) {
    resolve()
  } else {
    reject()
  }
})

promise.then(run1)
  .then(run2)
  .then(run3)
  // ...

promise.catch(run4)
  .then(run5)
  .then(run6)
  // ...

promise.then(run7)
  .then(run8)
  // ...
```

## Promise 并行执行与管理

在 JavaScript 当中，异步任务本身就是并行执行的。前面所提到的基于 Promise 的异步任务串行执行，本质上是通过 `.then()` 方法去控制上一个异步任务完成之后再触发下一个异步任务的执行，所以如果要改造成并行执行，只需要同步地创建这些异步任务，并对它们的 Promise 对象进行相应的管理即可。

下面的例子展示了并行获取异步数据 x 和 y，并且在 x 和 y 全部获取之后输入它们的相加结果，其中 `getX()` 和 `getY()` 分别是 x 和 y 的异步获取方法，`getXAndY()` 用于同步返回 x 和 y 的结果：

```js
function getX () {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(1)
    }, 1000)
  })
}

function getY () {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(10)
    }, 2000)
  })
}

function getXAndY([promiseX, promiseY]) {
  let results = []
  return promiseX
    .then(x => {
      results.push(x)
        return promiseY
      })
    .then(y => {
      result.push(y)
        return results
    })
}

getXAndY([
  getX(),
  getY()
])
.then(results => {
  console.log(x + y)
})
```

执行结果如下：

```bash
# (...2s)
11
```

可以看到 2s 后控制台输出了结果 11，说明 `getX()` 和 `getY()` 是并行执行的，并且在两个 Promise 状态全部成功之后，再最终返回两者的相加结果。

这里的 `getXAndY()` 就属于一种并行状态管理的方案。事实上 Promise 已经提供了 `Promise.all()` 方法来实现同样的功能。因此上述代码可修改为使用 `Promise.all()` 的形式：

```js
Promise.all([
  getX(),
  getY()
])
.then(results => {
  console.log(x + y)
})
```

除了 `Promise.all()`，Promise 还提供了 `Promise.race()` 方法，用于获取第一个发生状态变更的 Promise 对象：

```js
Promise.race([
  getX(),
  getY()
])
.then(value => {
  // 打印“1”，因为 x 的结果最先返回
  console.log(value)
})

Promise.race([
  getX(),
  new Promise((resolve, reject) => {
    reject('error')
  })
])
// 不会进入 onFulfilled
.then(value => {
  console.log(value)
})
// 打印“error”
// 因为这个 Promise 最先返回
.catch(error => {
  console.log(error)
})
```

假如 `Promise.all()` 和 `Promise.race()` 都无法满足应用场景，我们也可以基于 Promise 的原理与特性，自行开发相应的并行执行管理方案，在这里就不做赘述了。

## 总结

这篇文章介绍了 Promise 基本用法，介绍了 Promise 对象所具有的特性如何解决异步状态的可靠性问题，最后介绍了基于 Promise 的串行和并行执行的实现原理。Promise 是前端异步编程的基础，随着前端生态的不断完善，网站功能的前后端交互将会变得越来越复杂，Promise
也将会在各种复杂的异步编程当中发挥着越来越重要的作用。
