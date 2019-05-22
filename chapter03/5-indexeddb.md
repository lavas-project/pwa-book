# IndexedDB

Cache Storage 是一种缓存管理的缓存空间，前面了解到了 Cache Storage 是基于键值对的方式缓存数据，是适用于存储和检索网络请求及响应的存储系统，不能提供搜索功能，不能建立自定义的索引。IndexedDB 是浏览器环境提供的本地数据库，允许存储大量的数据，提供查询接口，还能创建索引等等。在存储结构上，数据库是存储一系列相关数据的容器，在每个域名下都可以新建多个数据库。IndexedDB 是一个非关系型的数据库，和平时所知道的关系型数据库（如 MySQL 等）有一定的区别，关系型数据库的内容是以记录为单位存储的，也就是说一条记录代表一条数据，而数据中的结构管理是通过记录的字段来指定存储的，而 IndexedDB 里面没有表和记录的概念，它的数据的最小单位是 JavaScript 对象（object），object 在 IndexedDB 里的地位就跟关系型数据库里面的记录一样，是数据的最终体现形式。

数据库存储结构上，关系型数据库和 IndexedDB 都可以划分为三个层次。

- 第一层：两者都有 database 的概念，要存储数据，首先要创建一个数据库。
- 第二层：两者就有了区别，关系型数据库有表的概念，而 IndexedDB 对应的是 objectStore。简单的说就是，在数据库中开辟一块 store 用来存储 object，同样，一个数据库中可以有多个（甚至无限个）objectStore。
- 第三层：关系型数据库有记录的概念，而 IndexedDB 直接存放 JavaScript 的 object 数据对象。

IndexedDB 存储的 object 是结构化数据。简单理解就是，不能存 function 等非结构化的数据，object 必须是以键值对组成的字面对象。并且支持嵌套结构，也就是说 object 里面嵌套了 object，和 JavaScript 实现无缝对接。而同样是本地化存储的 localStorage 却需要对数据格式化为字符串后才能保存。

HTML5 API 规范提供了一套 IndexedDB API, 可以使用 `indexedDB.open()` 方法来打开或者创建数据库，如下面代码所示：

```js
// 如果有 mydb 这个数据库，就直接打开
// 如果没有，就会创建 mydb 数据库
let request = window.indexedDB.open('mydb', 1)
```

`indexedDB.open()` 方法有两个参数，第一个参数为数据库名，第二个参数为数据库版本。

## IndexedDB 简介

IndexedDB 和关系型数据库的不同，主要体现在数据库存储结构设计上和数据操作方式上。下面介绍一些 IndexedDB 一些基本的概念，可以快速的了解 IndexedDB 的大致架构设计。

### 数据库版本

从 `indexedDB.open()` 方法的参数来看，很容易注意到 IndexedDB 存在版本的概念。例如：当数据库的 version 为 `1` 时，创建了一些 objectStore，当需要添加新的 objectStore 或者修改某些 objectStore 的时候，就需要升级 version。这时可能有两个不同的 version `1` 和 `2`. 此时用 `indexedDB.open()` 方法打开一个 version 的时候，得到的 db 容器对应的 objectStore 是不同的，如果此时还要打开 version 为 `1` 的数据库，那么在 version 为 `2` 中创建的 objectStore 和新增的 object 都是不存在的。由其可见新的 version 一般包含了老的 version。

通常在代码操作中，你要时刻保证你使用对了 version，它的使用场景只有两种：

- 当需要修改 objectStore 时
- 当需要添加新的 objectStore 时

从代码的层面来看，并非这两个事情发生才触发了 version 的改变，恰恰相反，如果要修改或添加 objectStore，必须通过传递新的 version 参数到 `indexedDB.open()` 方法中，触发 `onupgradeneeded` 事件，在 `onupgradeneeded` 的回调函数中才能实现目的。从项目的开发上讲，只会在重新发布代码时去升级 version，而不会在程序运行过程中通过程序去更改 version。升级 version，是为了对数据库结构进行修改。

### 数据库容器

IndexedDB 中非常重要的概念是 transaction（事务），不过会在后面具体介绍事务。这里只需要了解一下调用 `indexedDB.open()` 方法之后如何操作数据库。要想操作 IndexedDB 数据，必须先创建一个数据库容器。操作数据库的存储结构以及数据的内容，都是要在数据库容器的基础上进行的，那怎么获得数据库容器呢？如下代码所示：

```js
let request = window.indexedDB.open('mydb', 1)
request.onsuccess = e => {
  // db 就是数据库容器
  let db = e.target.result
  // 使用 db 数据库容器，可以接着做一些数据处理 ...
}
```

IndexedDB 数据库的事件回调中都会在事件对象中带有数据库容器对象，可以通过 `event.target.result` 获取，在这个例子中是在 IndexedDB 数据库打开或者创建成功后通过 `onsuccess` 事件回调获取到了数据库容器。

### 对象仓库

objectStore 是 IndexedDB 中非常核心的概念，在前面的介绍中，也知道了它是数据的存储仓库，一个 objectStore 类似于关系型数据库中的表，存放着相关的所有数据。所谓的 “相关” 是指，这些 object 必须具备相同的一个属性名，也就是**主键** ，在 IndexedDB 中被称之为 keyPath。这还有点像关系型数据库中的 primaryKey，不过关系型数据库中不必一定有 primaryKey，而 objectStore 中的 keyPath 必须有。

如果存入的某个 object 不存在那个属性，而该属性在 IndexedDB 中又不是 autoIncrement，那么就会报错，如果 autoIncrement 被设置为 `true`，在没有该 key 的情况下，存入数据库的时候，会被自动添加上，这个效果跟关系型数据的自增字段是一样的。

在使用事务对 objectStore 进行操作前，需要创建对应的 objectStore。创建 objectStore 和修改 objectStore 都只能在 db 的 `onupgradeneeded` 事件中进行，因此要创建 objectStore 必须在 `indexedDB.open()` 操作之后来进行，如下代码所示：

```js
let request = window.indexedDB.open('mydb', 1)
request.onupgradeneeded = e => {
  let db = e.target.result
  db.createObjectStore('mystore', {keyPath: 'id'})
}
```

上面的代码中使用 `db.createObjectStore()` 方法来实现 objectStore 的创建。但是需要注意的是，一个 db 中是不允许同名的 objectStore 的，因此，如果第二次通过 `createObjectStore()` 创建相同名的 objectStore，程序会报错。

另外，一旦一个 objectStore 被创建，它的 name 和 keyPath 是不能修改的。可以通过 `db.objectStoreNames` 属性来判断是否已经存在同名的 objectStore 可以避免这个问题，如下代码所示：

```js
let request = window.indexedDB.open('mydb', 2)
request.onupgradeneeded = e => {
  let db = e.target.result
  let objectStore
  // 如果不存在同名的 Store，就创建一个
  if (!db.objectStoreNames.contains('mystore')) {
    objectStore = db.createObjectStore('mystore', {keyPath: 'id'})
  } else {
    // 如果存在同名的 store，就直接取出来
    objectStore = e.target.transaction.objectStore('mystore')
  }
}
```

### 索引

在 IndexedDB 中也存在索引，但和关系型数据库中索引的作用不同，关系型数据库中的索引是对指定字段进行特殊记录，以方便在检索时提高检索性能。IndexedDB 中的索引，是指在除了设置的 keyPath 之外，提供其他的检索方式。在 IndexedDB 中，`objectStore.get()` 方法用来获取某一条数据，但是它的默认的参数是 keyPath 对应的值。而如果要用其他的字段来检索某个 object，那就麻烦了，所以 IndexedDB 提供了索引的方式，通过一个 index 方法来实现索引检索。所以看起来 objectStore 的索引，等效于关系型数据库中的表的字段。

前面反复提到 keyPath 这个概念。在前面的代码里面可以发现在 `db.createObjectStore()` 的时候，可以指定一个 keyPath。实际上，keyPath 的概念非常简单，它规定了必须要把 object 属性作为检索的入口。如 objectStore 中有一堆对象，如下所示：

```js
{
  id: 1,
  name: 'data1'
}
{
  id: 2,
  name: 'data2'
}
```

如上代码所示，设置的 keyPath 为 `id`, 可以通过 `objectStore.get(1)` 方法来获取 keyPath 为 `id = 1` 的那条数据，因此，id 对于所有 object 而言是应该是唯一的。需要在建立索引的时候，传入一个 `unique` 参数确保唯一，所以实际上 `db.createObjectStore()` 的时候传入的 keyPath 是一个特殊的索引。创建索引实际上是对 `objectStore` 进行修改，因此，只能在数据库的 `onupgradeneeded` 事件中处理，如下代码所示：

```js
let request = window.indexedDB.open('mydb', 3)
request.onupgradeneeded = e => {
  let db = e.target.result
  // 注意这里应该进行判断是否已经存在这个 objectStore，在这里略过
  let objectStore = db.createObjectStore(
    'mystore',
    {keyPath: 'id'}
  )
  // 创建 id 为索引
  objectStore.createIndex('id', 'id', {unique: true})
}
```

objectStore 对象有一个 `createIndex()` 方法，它可以创建索引。它有三个参数:

- 第一个参数是这个索引的 name。
- 第二个参数是 key，这个 key 对应的就是 object 的属性名，name 是可以自己定的，它会用在后面的 index 方法中进行检索，也会被记录在 objectStore 的 indexNames 属性里面，但是 key 必须和 object 的属性对应。
- 第三个参数是 options，其中 unique 选项被放在这里面。

objectStore 本身的信息是不能修改的，例如 name 和 keyPath 都是不能修改的，但是它所拥有的索引可以被修改，修改其实就是删除或添加操作。删除用到的就是 `objectStore.deleteIndex()` 这个方法，如果想修改一个索引，要做的就是先删除掉原来的同名索引，然后添加新的索引，如下面代码所示：

```js
let request = window.indexedDB.open('mydb', 4)
request.onupgradeneeded = e => {
  // 从事务中获取已经存在的 objectStore
  let objectStore = e.target.transaction.objectStore('mystore')
  let indexNames = objectStore.indexNames
  // 先删除对应的索引
  if (indexNames.includes('name')) {
    objectStore.deleteIndex('name')
  }
  // 再重新创建一个新的同名索引
  objectStore.createIndex('name', 'name', {unique: false})
}
```

### 事务

所有数据库中都有事务这个概念，它是为了确保当某些操作部分执行时不致混乱。举个简单的例子，当你转账给别人的时候，发起了一个请求，你的银行就操作从数据库里把相应的钱扣掉，但是这时候银行机房出问题了，你朋友的银行并没有收到这个转入的请求，那岂不是会出现你的钱已经扣了，但是别人并没有收到的情况？

数据库系统为了避免这种情况，采用事务机制，如果出错那就回滚，把你打出去但对方没收到的钱回到你账上，重新再执行一次打钱的操作，这样就保证了数据库增删改有序不混乱。

IndexedDB 里面的事务也是一样，保证了所有操作（特别是写入操作）是按照一定的顺序进行，不会导致同时写入的问题。另外，IndexedDB 强制规定了任何 object 读写的操作都必须在一个事务中进行。从前面的代码里面你也看到了，对 objectStore 的修改其实也是在一个事务中进行。

在代码层面必须通过 `db.transaction()` 方法向数据库容器提出事务要求，才能对具体的 objectStore 进行数据处理：

```js
let request = window.indexedDB.open('mydb', 5)
request.onsuccess = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readonly'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  let objectRequest = objectStore.get('111')
  objectRequest.onsuccess = e => {
    // 获取到的数据
    let object = e.target.result
  }
}
```

上面这段代码的操作，得到了具体要进行操作的 objectStore，这与直接通过 `db.objectStore('myObjectStore')` 这样简洁的方法完全不同，IndexedDB 中不能这么直接去获取 objectStore，而必须通过 `db.transaction()` 方法。`db.transaction()` 方法有两个参数：

- objectStores：事务打算对哪些 objectStore 进行操作，因此是一个数组
- mode：对进行操作的 objectStore 的模式，即读写权限控制，readonly | readwrite

而通过 `transaction.objectStore()` 方法可以获取想要操作的 objectStore ，但是它的参数必须存在于 `db.transaction()` 方法指定的 objectStores 参数数组中，毕竟这个事务已经规定了要对哪些 objectStore 进行操作。

因为 objectStore 是在事务中获取，因此一个 objectStore 实例，如果有一个 transaction 属性的话，那么可以通过这个属性找出它的事务的实例。在 IndexedDB 中，只能在事务中得到一个 objectStore 实例，如果通过 db 的话，最多只能得到 objectStore 的名字列表，如果要获得 objectStore 的实例，必须在 transaction 中。

### 操作请求

Request 是在事务过程中，发起某项操作的请求。一个事务过程中，可以有多个 Request，Request 一定存在于事务中，因此它肯定会有一个 transaction 属性来获取它所属于的那个事务的容器。我们可以把 transaction 当做一个队列，在这个队列中，Request 进行排队，每一个 Request 都只包含一个操作，比如添加，修改，删除数据之类的。这些操作不能马上进行，比如修改操作，如果马上进行，就会导致大家同时修改怎么办的问题，把多个修改操作放在 Request 中，这些 Request 在 transaction 中排队，一个一个处理，这样就会有执行的顺序，修改就有前后之分。同时，transaction 都可以被中断，这样当一系列的操作被放弃之后，后续的操作也不会进行。

而且有意思的是，Request 是异步的，它是有状态的。一个 Request 处于什么状态，可以通过 readyStates 属性查到，这对开发者而言也更可控。目前，在 IndexedDB 中，有四种情形产生 Request：`open database`，`objectStore request`, `cursor request`, `index request`。

### 游标

所谓游标，简单的理解，就是“**一个用来记录数组正在被操作的某个下标位置的变量**”，举个例子：对数组 `[1, 2, 3, 4]` 进行遍历，可以使用 `forEach()` 方法，那么 `forEach()` 方法怎么知道上次操作到第几个元素，又怎么知道现在应该操作第几个元素呢？就是通过游标来判断。

游标是一个机制，无法把游标打印出来看，可以通过游标得到你当前操作的元素，换句话说，游标有着类似 `next()` 的方法，可以用来移动游标到下一个位置。

当数据量巨大的时候，想要获取一个 objectStore 中的全部 object 可不是一件简单的事。IndexedDB 没有直接提供类似的方法来获取。但是可以利用游标来解决，如下代码所示：

```js
let request = window.indexedDB.open('mydb', 10)
request.onsuccess = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readonly'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  // 打开一个游标
  let cursorRequest = objectStore.openCursor()
  let results = []
  cursorRequest.onsuccess = e => {
    let cursor = e.target.result
    if (cursor) {
      results.push(cursor.value)
      cursor.continue()
    } else {
      // 遍历之后的 object 数据列表的结果
      console.log(results)
    }
  }
}
```

通过 `objectStore.openCursor()` 方法打开游标机制，该方法返回一个 Request 对象，在这个 Request 对象的 `onsuccess` 回调中，如果 cursor 没有遍历完所有 object，那么通过执行 `cursor.continue()` 来让游标滑动到下一个 object，`onsucess` 回调会被再次触发。而如果所有的 object 都遍历完了，cursor 变量会是 `undefined`。

注意上面的 results 变量，它的声明必须放在 `onsuccess` 回调函数的外部，因为该回调函数会在遍历过程中反复执行。

在 Firefox 浏览器中自主实现了一个 `getAll()` 方法可以获取 objectStore 中所有的 object，但是它不是标准的 IndexedDB 的接口，因此不推荐使用，而本例的操作方法，通常是获取全部 object 的标准做法。由此可以总结出游标就是对已知的集合对象（比如 objectStore 或 indexView）进行遍历，在 `onsuccess` 回调中使用 `cursor.continue()` 来进行控制。

### 主键范围

可以使用 IDBKeyRange 对象定义索引的范围。此对象有四种方法用于定义范围的限制：`upperBound()`、`lowerBound()`、`bound()` 和 `only()`。`upperBound()` 和 `lowerBound()` 方法指定了范围的上限和下限。可以通过 `IDBKeyRange.lowerBound(indexKey)` 方法指定索引的下边界，也可以使用 `IDBKeyRange.upperBound(indexKey)` 方法指定索引的上边界。当然还可以使用 `bound()` 方法同时指定上下边界：`IDBKeyRange.bound(lowerIndexKey, upperIndexKey)`。

接下来看一个代码示例：在 myObjectStore 对象库中的 price 属性上创建了一个索引，并添加了一个带有两个输入的小型表格，用于为游标设置范围的上限和下限。代码如下所示：

```js
function searchItems(lower, upper) {
  if (lower === '' && upper === '') {
    return
  }

  // 设置
  let range
  if (lower !== '' && upper !== '') {
    range = IDBKeyRange.bound(lower, upper)
  } else if (lower === '') {
    range = IDBKeyRange.upperBound(upper)
  } else {
    range = IDBKeyRange.lowerBound(lower)
  }

  let request = window.indexedDB.open('mydb', 11)
  request.onsuccess = e => {
    let db = e.target.result
    let transaction = db.transaction(
      ['myObjectStore'],
      'readonly'
    )
    let store = transaction.objectStore('myObjectStore')
    let index = store.index('price')
    // 索引打开带有主键集合的游标
    let cursorRequest = index.openCursor(range)
    let results = []
    cursorRequest.onsuccess = e => {
      let cursor = e.target.result
      if (cursor) {
        console.log('游标位置在: ', cursor.key)
        results.push(cursor.value)
        cursor.continue()
      } else {
        // 遍历之后的 object 数据列表的结果
        console.log(results)
      }
    }
  }
}
```

## IndexedDB 的增删改查

和任何数据库一样，IndexedDB 也是进行数据存储，并提供一些方式让开发者可以对数据进行查询、添加、删除、修改。当一个事务开始之后，在它的生命周期以内，可以对 objectStore 进行数据操作，下面会通过一些简单的示例对 IndexedDB 的增删改查操作进行介绍。

### 获取数据

前面介绍过如何获取事务中的 objectStore，现在就用获取到的 objectStore 进行数据操作，如下代码所示。

```js
let request = window.indexedDB.open('mydb', 6)
request.onsuccess = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readonly'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  let objectRequest = objectStore.get('100001')
  objectRequest.onsuccess = e => {
    // 获取到的数据
    let object = e.target.result
  }
}
```

在 IndexedDB 事务机制下进行操作是很麻烦的，上面代码中使用了 `objectStore.get()` 方法获取主键值为 `100001` 的 object，但是获取过程是一个 Request 对象，只有在其 `onsuccess` 事件中才能得到获取到的结果。

### 添加数据

```js
let request = window.indexedDB.open('mydb', 7)
request.onupgradeneeded = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readwrite'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  // 写入一条数据
  objectStore.add({
    id: '100002',
    name: 'Zhang Fei',
  })
}
```

添加数据使用 `objectStore.add()` 方法，传入一个 object。但是这个 object 有限制，它的主键值，也就是 id 值，不能是已存在的，如果 objectStore 中已经有了这个 id，那么会报错。因此，在某些程序中为了避免这种情况的发生，通常会使用 `objectStore.put()` 方法。

### 更新数据

```js
let request = window.indexedDB.open('mydb', 8)
request.onupgradeneeded = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readwrite'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  // 更新一条数据
  objectStore.put({
    id: '100002',
    name: 'Zhang San',
  })
}
```

`objectStore.put()` 方法和 `objectStore.add()` 方法有两大区别。

- 如果 objectStore 中已经有了该id，则表示更新这个object，如果没有，则添加这个 object。
- 在另一种情况下，也就是设置了 autoIncrement 为 true 的时候，也就是主键自增的时候，`objectStore.put()` 方法必须传第二个参数，第二个参数是主键的值，以此来确定你要更新的是哪一个主键对应的 object，如果不传的话，可能会直接增加一个 object 到数据库中。从这一点上讲，自增字段确实比较难把握，因此我建议开发者严格自己在传入时保证 object 中存在主键值。

### 删除数据

```js
let request = window.indexedDB.open('mydb', 9)
request.onupgradeneeded = e => {
  let db = e.target.result
  let transaction = db.transaction(
    ['myObjectStore'],
    'readwrite'
  )
  let objectStore = transaction.objectStore('myObjectStore')
  // 删除一条数据
  objectStore.delete('100001')
}
```

`objectStore.delete()` 方法将传入的主键值对应的 object 从数据库中删除。

## 利用 IndexedDB 实现 DB 类

接下来利用 IndexedDB 实现一个 DB 类，将 IndexedDB 的数据存储模式简化为键值对的形式，并实现一些常用的 setItem/getItem/getAllItems/removeItem 等方法。这样我们就可以通过 DB 类的实例，以类似 localStorage 的 API 去使用 IndexedDB 了。

### 构造函数

在初始化时，需要传入 dbName、version、storeName 三个参数，分别对应数据库名、数据库版本号、对象仓库名：

```js
class DB {
  constructor ({
    dbName = 'db',
    version = 1,
    storeName
  }) {
    this.dbName = dbName
    this.storeName = storeName
    this.version = version
  }

  // ...
}
```

其中 dbName 和 version 我们设置了默认值，因此在实例化 DB 类的时候，只需要传入 storeName 即可：

```js
const db = new DB({storeName: 'test'})
```

### 获取数据库实例

接下来封装 `getDB()` 方法来获得数据库实例，并且在数据库初始化时创建对象仓库，由于在这里我们使用键值对的存储形式，因此规定存储对象结构为：`{key, value}` ，其中 `key` 存放数据的键名，value 存放值。同时由于 IndexedDB 采用回调函数的异步机制，我们可以通过实现简单的 `promisify` 方法将回调修改成 Promise 的异步形式。具体实现如下所示：

```js
class DB {
  // ...

  async getDB () {
    // 优先返回缓存的数据库实例
    if (this.db) {
      return this.db
    }
    // 打开数据库
    let request = indexedDB.open(this.dbName, this.version)
    // 当数据库初始化或升级时创建仓库
    request.onupgradeneeded = event => {
      let db = event.target.result
      // 当仓库不存在时创建仓库，同时规定 key 为索引
      if (!db.objectStoreNames.contains(this.storeName)) {
        db.createObjectStore(this.storeName, {keyPath: 'key'})
      }
    }

    let event = await promisify(request)
    this.db = event.target.result
    return this.db
  }
}
```

其中 `promisify()` 方法实现如下：

```js
function promisify (request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = resolve
    request.onerror = reject
  })
}
```

这样我们就可以通过 getDB() 方法初始化好仓库，并最终获得数据库实例，接下来就可以实现其他操作数据库的方法了。

### 写入数据 setItem()

`setItem()` 用于将数据写入 indexedDB，它接收两个参数分别为 key 和 value，其中 key 要求为字符串类型，value 为 IndexedDB 允许存储的类型即可。

```js
class DB {
  // ...

  async setItem (key, value) {
    // 获取数据库
    let db = await this.getDB()
    // 创建事务，指定使用到的仓库名以及读写权限
    let transaction = db.transaction([this.storeName], 'readwrite')
    // 获取仓库实例
    let objectStore = transaction.objectStore(this.storeName)
    // 将 key 和 value 包装成对象 {key, value} 并存入仓库
    let request = objectStore.put({key, value})
    // 异步执行结果通过 Promise 返回
    return promisify(request)
  }
}
```

通过 `setItem()` 方法，我们就可以方便地写入数据了：

```js
// 存入数字
db.setItem('number', 1)
  .then(() => {console.log('写入成功！')})
// 存入 Plain Object
db.setItem('/path/to/data', {status: 0, data: 'Hello World'})
  .then(() => {console.log('写入成功！')})
```

### 读取数据 getItem() 与 getAll()

#### getItem()

`getItem()` 用于获取数据，它接收参数 key，作为查找资源的标识：

```js
class DB {
  // ...
  async getItem (key) {
    // 获取数据库实例
    let db = await this.getDB()
    // 创建事务，并指定好仓库名以及操作的只读权限
    let transaction = db.transaction([this.storeName], 'readonly')
    // 获取仓库实例
    let objectStore = transaction.objectStore(this.storeName)
    // 查找对应的数据并通过 Promise 对象包装后返回
    let request = objectStore.get(key)
    let event = await promisify(request)
    return event.target.result && event.target.result.value
  }
}
```

使用 getItem() 读取数据的方法也非常简单：

```js
db.getItem('number')
  // 打印 1
  .then(value => console.log(value))

db.getItem('/path/to/data')
  // 打印 {status: 0, data: 'Hello World'}
  .then(value => console.log(value))
```

#### getAll()

`getAll()` 用于获取数据库的全部数据，返回的结果为 Promise 包装的 Map 对象：

```js
class DB {
  // ...

  async getAll () {
    // 获取数据库实例
    let db = await this.getDB()
    // 创建事务，并指定好仓库名以及操作的只读权限
    let transaction = db.transaction([this.storeName], 'readonly')
    // 获取仓库实例
    let objectStore = transaction.objectStore(this.storeName)
    // 读取仓库全部数据
    let request = objectStore.getAll()
    let event = await promisify(request)
    let result = event.target.result
    // 当数据为空时，返回空
    if (!result || !result.length) {
      return
    }
    // 数据不为空时，将数据包装成 Map 对象并返回
    let map = new Map()
    for (let {key, value} of result) {
      map.set(key, value)
    }
    return map
  }
}
```

这样通过 getAll() 方法就可以异步获取仓库中存储的全部数据了：

```js
db.getAll()
  // 打印 Map(2) {
  //   'number' => 1,
  //   '/path/to/data': {status: 0, data: 'Hello World'}
  // }
  .then(map => console.log(map))
```

### 删除数据 removeItem()

`removeItem()` 用于删除数据，通过参数 key 进行数据匹配并删除：

```js
class DB {
  // ...

  async removeItem (key) {
    // 获取数据库实例
    let db = await this.getDB()
    // 创建事务，并指定好仓库名以及删除操作的读写权限
    let transaction = db.transaction([this.storeName], 'readwrite')
    let objectStore = transaction.objectStore(this.storeName)
    // 删除数据，并用 Promise 进行包裹
    let request = objectStore.delete(key)
    return promisify(request)
  }
}
```

这样删除数据操作可以简化为如下形式：

```js
db.removeItem('number')
  // 数据删除成功时 Promise 对象执行 resolve
  .then(() => console.log('删除成功'))
```
