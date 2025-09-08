# 小程序图标系统使用指南

本项目保留了字体图标系统（iconfont），适用于页面内的装饰性图标。

## ⚠️ 重要说明
- **TabBar图标**：只能使用PNG格式图片，不支持SVG或字体图标
- **页面内图标**：可以使用字体图标系统，体积小、可定制

## 1. 使用字体图标（推荐用于页面装饰）

### 基础用法
```html
<text class="iconfont icon-home"></text>
<text class="iconfont icon-services" style="font-size: 32rpx; color: #1976D2;"></text>
```

### 可用图标
- `icon-home` / `icon-home-active` - 首页图标
- `icon-services` / `icon-services-active` - 医疗服务图标  
- `icon-orders` / `icon-orders-active` - 订单图标
- `icon-profile` / `icon-profile-active` - 个人中心图标
- `icon-user` - 用户图标
- `icon-avatar` - 头像图标
- `icon-share` - 分享图标
- `icon-wechat` - 微信图标
- `icon-medical` - 医疗图标
- `icon-arrow-right` / `icon-arrow-left` - 箭头图标
- `icon-check` / `icon-close` - 选中/关闭图标
- `icon-loading` - 加载图标
- `icon-success` / `icon-error` / `icon-warning` - 状态图标

## 2. 使用图标组件

### 引入组件
在页面的JSON文件中添加：
```json
{
  "usingComponents": {
    "icon": "/components/icon/icon",
    "icon-font": "/components/icon-font/icon-font"
  }
}
```

### 使用组件
```html
<icon name="home" size="48" color="#1976D2"></icon>
<icon-font name="services" size="32" color="#333"></icon-font>
```

## 3. TabBar图标（必须使用PNG）

现在使用的PNG文件：
- `images/home.png` / `images/home-active.png`
- `images/services.png` / `images/services-active.png`
- `images/orders.png` / `images/orders-active.png`
- `images/profile.png` / `images/profile-active.png`

## 4. 使用场景建议

### ✅ 适合使用字体图标的场景：
- 按钮内的小图标
- 列表项的装饰图标
- 状态提示图标
- 导航箭头等功能图标

### ❌ 不适合使用字体图标的场景：
- TabBar图标（必须PNG）
- 复杂的插画或品牌图标
- 需要渐变色的图标

## 5. 文件结构

```
miniprogram/
├── styles/
│   └── iconfont.wxss          # 字体图标样式
├── components/
│   ├── icon/                  # 通用图标组件
│   └── icon-font/            # 字体图标组件
├── images/
│   ├── *.png                 # TabBar和其他位图图标
│   └── default-avatar.png    # 默认头像
└── ICON_GUIDE.md            # 本使用指南
```

## 6. 优势与限制

### ✅ 字体图标优势：
- 体积小，减少包大小
- 可通过CSS控制颜色和大小
- 在不同分辨率下保持清晰

### ⚠️ 小程序限制：
- TabBar只支持PNG格式
- 部分复杂SVG效果不兼容
- 字体图标加载依赖网络或本地字体文件

## 7. 最佳实践

1. **TabBar图标**：使用48x48px的PNG文件
2. **页面图标**：优先使用字体图标，fallback用PNG
3. **图标颜色**：使用项目主题色 `#1976D2`
4. **图标大小**：常用尺寸 32rpx、48rpx、64rpx

这样既保证了兼容性，又为页面内图标提供了现代化的解决方案。