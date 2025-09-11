# 微信小程序手机号获取流程

## 概述
已成功实现微信小程序手机号获取功能，包含以下API端点：
1. `/api/auth/wechat` - 微信登录（支持手机号）
2. `/api/auth/phone` - 独立的手机号获取接口

## API使用方法

### 方式一：登录时同时获取手机号

**小程序端代码示例：**

```javascript
// 小程序页面
Page({
  data: {
    userInfo: null
  },

  // 获取手机号并登录
  async onGetPhoneNumber(e) {
    console.log('获取手机号回调:', e.detail);
    
    if (e.detail.code) {
      // 用户同意获取手机号
      const phoneCode = e.detail.code;
      
      // 获取微信登录code
      const loginRes = await wx.login();
      if (!loginRes.code) {
        wx.showToast({ title: '登录失败', icon: 'none' });
        return;
      }

      // 调用后端API，同时传递登录code和手机号code
      try {
        const response = await wx.request({
          url: 'https://你的域名/api/auth/wechat',
          method: 'POST',
          data: {
            code: loginRes.code,      // 微信登录code
            phoneCode: phoneCode      // 手机号授权code
          }
        });

        if (response.data.success) {
          // 登录成功，获取到用户信息和手机号
          console.log('登录成功:', response.data);
          this.setData({
            userInfo: response.data.user
          });
          
          // 存储token
          wx.setStorageSync('access_token', response.data.token);
          
          wx.showToast({ title: '登录成功', icon: 'success' });
        } else {
          wx.showToast({ title: response.data.error || '登录失败', icon: 'none' });
        }
      } catch (error) {
        console.error('请求失败:', error);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    } else {
      // 用户拒绝获取手机号
      wx.showToast({ title: '需要获取手机号才能继续', icon: 'none' });
    }
  },

  // 仅登录（不获取手机号）
  async onLogin() {
    const loginRes = await wx.login();
    if (!loginRes.code) {
      wx.showToast({ title: '登录失败', icon: 'none' });
      return;
    }

    try {
      const response = await wx.request({
        url: 'https://你的域名/api/auth/wechat',
        method: 'POST',
        data: {
          code: loginRes.code
        }
      });

      if (response.data.success) {
        console.log('登录成功:', response.data);
        this.setData({
          userInfo: response.data.user
        });
        wx.setStorageSync('access_token', response.data.token);
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  }
});
```

**小程序页面WXML：**

```xml
<view class="container">
  <block wx:if="{{!userInfo}}">
    <!-- 获取手机号并登录按钮 -->
    <button 
      open-type="getPhoneNumber" 
      bindgetphonenumber="onGetPhoneNumber"
      class="login-btn"
      type="primary">
      获取手机号并登录
    </button>
    
    <!-- 仅登录按钮 -->
    <button 
      bindtap="onLogin"
      class="login-btn"
      type="default">
      仅登录
    </button>
  </block>
  
  <block wx:else>
    <!-- 用户信息显示 -->
    <view class="user-info">
      <text>用户ID: {{userInfo.id}}</text>
      <text>昵称: {{userInfo.nickname}}</text>
      <text wx:if="{{userInfo.phoneNumber}}">手机号: {{userInfo.phoneNumber}}</text>
      <text>OpenID: {{userInfo.openId}}</text>
    </view>
  </block>
</view>
```

### 方式二：分步获取（先登录再获取手机号）

**小程序端代码示例：**

```javascript
Page({
  data: {
    userInfo: null,
    isLoggedIn: false
  },

  // 第一步：登录
  async onLogin() {
    const loginRes = await wx.login();
    if (!loginRes.code) return;

    try {
      const response = await wx.request({
        url: 'https://你的域名/api/auth/wechat',
        method: 'POST',
        data: { code: loginRes.code }
      });

      if (response.data.success) {
        this.setData({
          userInfo: response.data.user,
          isLoggedIn: true
        });
        wx.setStorageSync('access_token', response.data.token);
      }
    } catch (error) {
      console.error('登录失败:', error);
    }
  },

  // 第二步：获取手机号
  async onGetPhoneNumber(e) {
    if (!e.detail.code) {
      wx.showToast({ title: '需要授权获取手机号', icon: 'none' });
      return;
    }

    try {
      const response = await wx.request({
        url: 'https://你的域名/api/auth/phone',
        method: 'POST',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('access_token')}`
        },
        data: {
          phoneCode: e.detail.code
        }
      });

      if (response.data.success) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...this.data.userInfo,
          phoneNumber: response.data.phoneNumber
        };
        this.setData({ userInfo: updatedUserInfo });
        wx.showToast({ title: '手机号获取成功', icon: 'success' });
      }
    } catch (error) {
      console.error('获取手机号失败:', error);
      wx.showToast({ title: '获取手机号失败', icon: 'none' });
    }
  }
});
```

## 重要说明

### 微信API要求
1. **getPhoneNumber 返回的 code 与 wx.login 返回的 code 作用不同，不能混用**
2. **每个手机号授权code有效期为5分钟，且只能使用一次**
3. **需要在微信公众平台配置域名白名单**

### 错误处理
- `40001`: access_token无效或已过期
- `40029`: 授权码无效  
- `40125`: 应用密钥无效
- `40163`: 授权码已过期或已使用

### 环境变量配置
确保在 `.env.local` 中配置：
```
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序AppSecret
JWT_SECRET=你的JWT密钥
```

### 数据库字段
用户表中的 `phone` 字段会自动更新为获取到的手机号码（不含区号的纯数字）。