/**
 * @file sw.js
 * @author pwa
 */

/* global self, caches, fetch */

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open('service-worker-cahce-demo')
      .then(cache => {
        // 在安装的时候将页面的静态资源都加入到缓存
        return cache.addAll([
          '/',
          '/index.html',
          '/index.js',
          '/index.css',
          '/imgs/dog.jpg'
        ])
      })
  )
})

self.addEventListener('fetch', event => {
  event.respondWith(
    // 当匹配到缓存中存在的静态资源请求，就优先从缓存中取
    caches.match(event.request).then(response => {
      // 如果命中了缓存，就直接返回缓存的内容
      if (response) {
        return response
      }
      // 如果没命中缓存，还是继续走网络请求
      // 在这个过程中，将网络请求写入缓存
      let fetchRequest = event.request.clone()

      return fetch(fetchRequest).then(response => {
        // 检查是不是一个正常的 response 返回
        if (!response ||
          response.status !== 200 ||
          response.type !== 'basic'
        ) {
          return response
        }

        // 将动态的网络请求写入缓存
        let responseToCache = response.clone()
        caches.open('service-worker-cahce-demo')
          .then(cache => {
            cache.put(event.request, responseToCache)
          })

        return response
      })
    })
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      self.clients.matchAll().then(clients => {
        clients && clients.length && clients.forEach(client => {
          // 给每个终端都发送 postMessage
          client.postMessage('sw.update')
        })
      })
      // 如果 Service Worker 的更新需要删除掉以前的老的缓存也可以在这进行
    ])
  )
})
