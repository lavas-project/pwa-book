/**
 * @file sw.js
 * @author pwa
 */

/* global self, Response */

// 为了保证每次新建的 indexedDB 都会触发更新
// 用时间戳来维护 db 的版本号
// 由于 Service Worker 只会在首次激活，所以能保证版本的激活时更新
let indexeddbVersion = Date.now()

function createDB () {
  return new Promise((resolve, reject) => {
    let request = self.indexedDB.open('fruits', indexeddbVersion)

    request.onupgradeneeded = e => {
      let db = e.target.result
      let store
      if (!db.objectStoreNames.contains('fruitStore')) {
        store = db.createObjectStore('fruitStore', {keyPath: 'id'})
      } else {
        store = e.target.transaction.objectStore('fruitStore')
      }

      store.put({
        id: 123,
        name: 'apple',
        price: 10.99,
        quantity: 200
      })

      store.put({
        id: 321,
        name: 'pear',
        price: 8.99,
        quantity: 100
      })

      store.put({
        id: 222,
        name: 'orange',
        price: 11.99,
        quantity: 300
      })

      resolve(true)
    }
  })
}

self.addEventListener('activate', event => {
  event.waitUntil(
    createDB()
  )
})

function readDB () {
  return new Promise((resolve, reject) => {
    let request = self.indexedDB.open('fruits', indexeddbVersion)
    request.onsuccess = e => {
      let db = e.target.result
      let transaction = db.transaction(['fruitStore'], 'readonly')
      let objectStore = transaction.objectStore('fruitStore')
      // 打开一个游标
      let cursorRequest = objectStore.openCursor()
      let results = []
      cursorRequest.onsuccess = e => {
        let cursor = e.target.result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          // 打印出所有的水果的信息
          resolve(new Response(JSON.stringify(results)))
        }
      }
    }
  })
}

self.addEventListener('fetch', event => {
  let url = event.request.url
  if (url.includes('/fruits.json')) {
    // 将从数据库中读取的水果列表数据当成 /fruits.json 请求的返回
    event.respondWith(
      readDB()
    )
  }
})
