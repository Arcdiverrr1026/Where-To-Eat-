# Where To Eat

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

用户确认：React + JavaScript；Node.js + Express；pg 驱动和手写 SQL；PostgreSQL；Docker Compose，在 OrbStack 中运行。以 Full Stack Open Part 3 学习程度为基准，不引入 TypeScript 或 ORM。React 组件和前后端应用函数统一使用箭头函数。

## Users

城市日常就餐者，首批为开发者身边的小范围用户。

## Product Purpose

根据位置、预算和口味快速决定附近吃什么，并理解推荐理由。也是可运行、可解释的全栈求职作品。

## Operating Context

先完成本地容器验收，之后部署至用户自己的服务器。本轮不涉及运营规划。

## Capabilities and Constraints

附近搜索、手动位置和浏览器定位、条件筛选、推荐、餐厅详情、演示账号登录退出、收藏、本人评价管理、精简管理员功能。不开放注册。地图提供基础信息，评价由本站用户产生。只做真实模式：缺配置、失败、空结果如实提示，不混入演示餐厅。不使用大模型或机器学习。

## Brand Commitments

名称 Where To Eat。界面自适应、简洁实用，列表为主，地图为辅助。使用中文。

## Evidence on Hand

旧版 Python + 静态页面有高德接入和 SQLite 代码；没有可用于声称真实用户规模、准确率或性能的数据。不得编造餐厅、评价或指标。测试夹具仅存在于隔离测试环境。

## Product Principles

- 决策路径短，推荐理由可追溯。
- 基础信息与本站评价分开呈现；未知价格保持未知。
- 后端统一业务规则，代码易读，按业务划分少量模块。
- 权限由后端检查，数据由 PostgreSQL 持久保存。
