Component({
  properties: {
    // 图标名称
    name: {
      type: String,
      value: ''
    },
    // 图标大小（rpx）
    size: {
      type: Number,
      value: 48
    },
    // 图标颜色
    color: {
      type: String,
      value: '#333'
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  data: {
    customStyle: ''
  },

  observers: {
    'size, color': function(size, color) {
      this.setData({
        customStyle: `font-size: ${size}rpx; color: ${color};`
      });
    }
  },

  ready() {
    this.setData({
      customStyle: `font-size: ${this.data.size}rpx; color: ${this.data.color};`
    });
  }
});