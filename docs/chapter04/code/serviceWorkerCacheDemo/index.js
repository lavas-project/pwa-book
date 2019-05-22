/**
 * @file index.js
 * @author pwa
 */

/* global fetch, alert */

fetch('./data.json')
  .then(response => response.json())
  .then(data => {
    // 将请求返回的数据打印出来
    let html = ['<table>']
    html.push('<tr><th>姓名</th><th>年龄</th><th>母语</th></tr>')
    data && data.length && data.forEach(item => {
      html.push('<tr>')
      html.push(`<td>${item.name}</td>`)
      html.push(`<td>${item.age}</td>`)
      html.push(`<td>${item.lang}</td>`)
      html.push('</tr>')
    })
    html.push('</table>')
    document.getElementById('demo-list').innerHTML = html.join('')
  })

navigator.serviceWorker.addEventListener('message', e => {
  if (e.data === 'sw.update') {
    alert('站点已更新，请刷新页面')
    // 如果代码走到了在这里，就知道了，Service Worker 已经更新完成了
    // 可以做点什么事情让用户体验更好
  }
})
