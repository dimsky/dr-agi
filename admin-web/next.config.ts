import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['api.weixin.qq.com', 'wx.qlogo.cn'],
  },
  env: {
    WECHAT_APPID: process.env.WECHAT_APPID,
    WECHAT_SECRET: process.env.WECHAT_SECRET,
  },
};

export default nextConfig;
