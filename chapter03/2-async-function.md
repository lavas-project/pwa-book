# Async 函数

上一节介绍了 Promise 对象，我们可以很方便地利用 Promise 将过去基于回调函数的异步过程改造成基于链式调用实现，这样更符合我们线性的思维习惯。但实践过程中发现，这种链式调用的异步方案仍然不够直观，我们更希望采用类似于同步函数的书写方式来实现异步。因此在 ES2017 标准中引入了 Async 函数（Async Functions）用于进一步简化异步编程。

需要注意的是，由于 Async 函数语法比较新，目前只在最新版的浏览器上得到了支持，因此在项目中如果使用了 Async 函数，可能需要准备 Babel 等代码编译工具，将 Async 函数语法转换成 ES5 语法实现。

![Async 函数兼容性](./img/async-function.png)

首先我们通过一个简单的例子来演示 Async 函数的作用。

在这之前首先准备一个异步函数 `sleep()`，其作用是将 setTimeout 方法用 Promise 对象进行包装：

```js
function sleep (time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  })
}
```

通过上一节的学习我们知道可以通过链式调用 `Promise.then` 方法来实现异步过程。比如下面的例子当中，在执行 `main()` 1 秒之后将在控制台打印出“结束”的文案的实现如下所示：

```js
function main () {
  console.log('开始：' + new Date())
  return sleep(1000)
    .then(() => {
      console.log('结束：' + new Date())
    })
}
```

接下来改用 Async 函数来实现同样功能的函数：

```js
async function main () {
  console.log('开始：' + new Date())
  await sleep(1000)
  console.log('结束：' + new Date())
}
```

可以看到，通过使用 `async` 和 `await` 修饰符改写之后的 `main()` 就不再需要书写复杂的 Promise 链式调用了，同时 Async 函数的语法也更为接近同步函数，无论是书写体验还是阅读体验都得到了较大的提升。

## 语法说明

### Async 函数定义

Async 函数需要通过 `async` 修饰符进行定义，下面所举例的定义方式都是合法的：

```js
// 普通函数
async function foo (/* 参数 */) {/* 函数体 */}
// 匿名函数
const foo = async function () {}
// 箭头函数
const foo = async () => {}
// 对象方法简写
const obj = {
  async foo () {}
}
// 函数作为参数
list.map(async () => {})
```

Async 函数会将函数体的所有执行结果通过一个隐式的 Promise 对象返回：

```js
async function foo () {}
// 等价于
function foo () {
  return new Promise(resolve => resolve())
}

async function foo () {
  return 'Hello World'
}
// 等价于
function foo () {
  return new Promise(resolve => resolve('Hello World'))
}

async function foo () {
  let promise = new Promise(resolve => resolve('Hello World'))
  return promise
}
// 等价于
function foo () {
  let promise = new Promise(resolve => resolve('Hello World'))
  return new Promise(resolve => resolve(promise))
}
```

### Async 函数错误处理

假如 Async 函数的函数体在执行过程中存在未捕获的错误，那么返回的 Promise 对象将会通过 reject 方法将异常值传递下去：

```js
async function foo () {
  throw Error('出错了')
}
// 等价于
function foo () {
  return new Promise((resolve, reject) => reject(Error('出错了')))
}
```

假如 Async 函数返回了异步的错误，也就是返回的 Promise 对象状态变更为 rejected，

```js
async function foo () {
  return Promise.reject('出错了')
}
// 等价于
function foo () {
  return new Promise(resolve => resolve(
    Promise.reject('出错了')
  ))
}
```

这样一来都可以通过链式调用来捕获异常：

```js
foo().then(
  () => {},
  e => {
    // 打印 '出错了'
    console.log(e)
  }
)
// 或
foo().catch(e => {
  // 打印 '出错了'
  console.log(e)
})
```

### await 表达式定义

Async 函数的函数体中可能存在 await 表达式。await 表达式非常简单，只需要在 Promise 对象前增加 `await` 关键字即可，同时 await 表达式的返回值就是 Promise 通过 resolve() 所返回的结果：

```js
async function main () {
  // sleep(1000) 返回 Promise 对象，并在 1s 后 resolve
  await sleep(1000)
  // val1 === 'Hello World'
  let val1 = await Promise.resolve('Hello World')
  // 等待 1s 后对 val2 进行赋值
  // val2 === 'Hello World'
  let val2 = await sleep(1000).then(() => 'Hello World')
}
```

await 表达式可以作为 Async 函数的返回结果：

```js
async function main () {
  return await sleep(1000).then(() => 'Hello World')
}

main().then(result => {
  // 打印 Hello World
  console.log(result)
})
```

当 `await` 关键字后面跟的不是 Promise 对象，会自动将其转换为 Promise 对象的返回结果：

```js
// 以下代码从 Async 函数体内节选

let val = await 'Hello World'
// 等价于
let val = await Promise.resolve('Hello World')
```

当 Async 函数执行到 await 表达式的时候会暂停执行，等待 await 表达式的 Promise 对象状态发生变更之后，再去执行后续的步骤。

### await 表达式错误用法

需要强调的是，await 表达式只能在 Async 函数中使用，如果在这个范围之外使用，程序将会报语法错误（SynaxError）。下面的例子举例了一些常见的错误用法：

```js
// 错误，await 表达式必须在 Async 函数中执行
await sleep(1000)

function foo () {
  // 错误，foo 不是 Async 函数
  await sleep(1000)
}

async function main () {
  const foo = () => {
    // 错误，因为该匿名函数不是 Async 函数
    await sleep(1000)
  }
}

async function bar () {
  let intervals = [1000, 1000, 2000]
  intervals.forEach(interval => {
    // 错误，因为该匿名函数不是 Async 函数
    await sleep(1000)
  })
}
```

### await 表达式异常捕获

`await` 关键字后面跟的 Promise 对象可能会执行 reject，这时 await 表达式就会抛出异常，异常值就是 reject 方法所回传的值。我们可以通过 `try/catch` 捕获这个异常并进行处理：

```js
async function foo () {
  try {
    await Promise.reject('发生错误')
  } catch (e) {
    // 打印 '发生错误'
    console.log(e)
  }
}
```

其效果与直接对 Promise 对象的异常进行捕获是等价的：

```js
async function foo () {
  await Promise.reject('发生错误')
    // 打印 '发生错误'
    .catch(e => console.log(e))
}
```

如果不对 await 表达式的抛错进行捕获处理，那么这个错误会继续向外传递，并最终以 Promise.reject 的方式将错误抛到 Async 函数外部：

```js
async function foo () {
  await Promise.reject('发生错误')
}
// 打印 '发生错误'
foo().catch(e => console.log(e))
```

## Async 函数用法举例

通过上面的学习对 Async 函数的语法和功能有了一定的了解之后，接下来我们准备几个示例来加深理解。

### 常规用法

在本示例中，将演示如何定义并使用异步函数、读取异步数据、捕获异步异常等等。

这个示例演示了这样一个过程，首先执行 getRandomNumber() 异步地获取一个 0 - 1 之间的随机数，然后送入 shouldLargerThan() 方法进行检查，当随机数小于给定的数值 0.5 时，抛出异常，反之则通过。

首先简单实现 getRandomNumber 和 shouldLargerThan 的功能：

```js
// 一秒后返回一个 0 - 1 的随机数
async function getRandomNumber () {
  await sleep(1000)
  return Math.random()
}
// 一秒后查看传入的数字是否大于期望值 spec
async function shouldLargerThan (spec, num) {
  await sleep(1000)
  // 当数值小于 0.5 时抛出异常
  if (num < spec) {
    throw '小于 ' + spec
  }
  console.log('大于等于 ' + spec)
}
```

接下来就可以定义执行整个异步过程的 Async 函数 `run()`：

```js
async function run () {
  // 获取异步数据
  let num = await getRandomNumber()
  console.log(num)
  try {
    await shouldLargerThan(0.5, num)
  } catch (e) {
    // 捕获异常
    // 打印 '小于 0.5'
    console.error(e)
  }
  console.log('结束')
}
run().then(() => console.log('任务全部执行完毕'))
// ... （等待 1s）
// 0.3（假设生成的随机数为 0.3）
// ... （等待 1s）
// 小于 0.5
// 结束
// 任务全部执行完毕
```

### 顺序执行异步操作

首先我们定义 3 个异步执行的任务，他们都会在任务开始的时候打印任务开始信息，等待一秒之后再打印任务结束信息。

```js
async function task1 () {
  console.log('Task1 开始')
  await sleep(1000)
  console.log('Task1 结束')
}
async function task2 () {
  console.log('Task2 开始')
  await sleep(1000)
  console.log('Task2 结束')
}
async function task3 () {
  console.log('Task3 开始')
  await sleep(1000)
  console.log('Task3 结束')
}
```

如果我们需要按顺序依次执行这些任务，根据前面所学内容，可以利用 await 表达式实现：

```js
async function main () {
  await task1()
  await task2()
  await task3()
}
main()
// Task1 开始
// ... （等待 1s）
// Task1 结束
// Task2 开始
// ... （等待 1s）
// Task2 结束
// Task3 开始
// ... （等待 1s）
// Task3 结束
```

我们可以使用 for 循环来简化这一过程，下面的示例展示了使用 for 循环实现同样的效果，读者可以自行尝试使用 for...of 或者 while 等循环语句实现：

```js
async function main () {
  const tasks = [task1, task2, task3]
  for (let i = 0; i < tasks.length; i++) {
    await tasks[i]()
  }
}
```

需要注意的是，这里的 for 循环无法用 forEach 代替，这是因为 forEach 只会同步执行它的回调函数，不会受到 await 的阻塞影响：

```js
tasks.forEach(async task => await task())
// 等价于
for (let task of tasks) {
  task()
}
```

### 并发执行异步操作

假设我们需要这些任务并行执行，那么不使用 await 表达式就能够实现：

```js
function main () {
  task1()
  task2()
  task3()
}

main()
// Task1 开始
// Task2 开始
// Task3 开始

// ... （等待 1s）

// Task1 结束
// Task2 结束
// Task3 结束
```

上面的函数可以使用 for/while/forEach 等等各种循环方法来进行简化：

```js
function main () {
  const tasks = [task1, task2, task3]
  tasks.forEach(task => task())
}
```

假设我们需要在所有的任务全部完成之后去执行某些操作，那么可以结合 Promise.all 方法实现：

```js
async function main () {
  await Promise.all([
    task1(),
    task2(),
    task3()
  ])
  console.log('任务全部执行完毕')
}
main()
// Task1 开始
// Task2 开始
// Task3 开始

// ... 等待 1s

// Task1 结束
// Task2 结束
// Task3 结束
// 任务全部执行完毕
```

我们也可以利用 `Array.map` 来简化这一过程：

```js
async function main () {
  const tasks = [task1, task2, task3]
  const promises = tasks.map(task => task())
  await Promise.all(promises)
  console.log('任务全部执行完毕')
}
```
