# Service Worker

Service Worker 是 PWA 技术基础之一，脱离浏览器主线程的特性，使得 Web App 离线缓存成为可能，更为后台同步、通知推送等功能提供了思路。Service Worker 和缓存之间的关系，可以理解为 Service Worker 是一种调度机制，类似于铁路调度系统，而缓存则类似于具体的火车，可以是绿皮车、动车、高铁等，所有的车都是基于这一套铁路调度系统在工作的，使用 Service Worker 可以在不同场景下更加精细化控制缓存。

本章中会深入 Service Worker 的技术细节，介绍 Service Worker 注册方法、生命周期以及更新机制等内容，并学习如何调试 Service Worker。掌握这些基本的知识，可以让我们更容易理解 PWA 离线缓存机制的实现原理。

