# JSON校验器部署指南

## 本地测试

1. 确保所有文件都在同一目录下：
   - `index.html` - 主应用页面
   - `styles.css` - 样式文件
   - `validator.js` - JavaScript逻辑

2. 启动本地服务器：
   ```bash
   # Python 3
   python3 -m http.server 8080
   
   # Node.js (需要先安装http-server)
   npx http-server
   ```

3. 在浏览器中访问：
   - http://localhost:8080 (或其他端口)

## 生产部署

### 静态文件托管

由于这是一个纯前端应用，可以部署到任何静态文件托管服务：

#### GitHub Pages
1. 创建GitHub仓库
2. 上传所有文件
3. 在仓库设置中启用GitHub Pages
4. 访问提供的URL

#### Netlify
1. 访问 netlify.com
2. 拖拽项目文件夹到部署区域
3. 自动获得部署URL

#### Vercel
1. 访问 vercel.com
2. 导入GitHub仓库或上传文件
3. 自动部署并获得URL

### CDN部署

将文件上传到CDN服务以获得更好的性能：

```bash
# 示例：使用AWS S3 + CloudFront
aws s3 sync . s3://your-bucket-name --exclude "*.md" --exclude "examples/"
```

## 集成到现有项目

### 方式1：iframe嵌入
```html
<iframe src="path/to/json-validator/index.html" width="100%" height="800px"></iframe>
```

### 方式2：直接集成
1. 复制HTML结构到您的页面
2. 引入CSS和JavaScript文件
3. 确保没有ID冲突

### 方式3：模块化使用
提取核心函数用于自定义实现：

```javascript
// 从validator.js中提取的核心函数
const validator = {
    flattenJSON: (obj, prefix) => { /* ... */ },
    cleanTranslatedObject: (obj) => { /* ... */ },
    compareJSON: (original, translated) => { /* ... */ },
    computeLCS: (original, translated) => { /* ... */ }
};
```

## 性能优化

### 文件压缩
```bash
# 压缩CSS
cleancss -o styles.min.css styles.css

# 压缩JavaScript
uglifyjs validator.js -o validator.min.js

# 更新HTML中的引用
```

### 缓存策略
- 设置适当的HTTP缓存头
- 使用版本号控制缓存失效
- 考虑使用Service Worker进行离线缓存

## 安全建议

1. **HTTPS**: 始终使用HTTPS协议
2. **CSP**: 设置内容安全策略
3. **XSS防护**: 对用户输入进行适当的转义
4. **文件验证**: 严格验证上传的文件类型和大小

## 监控和维护

### 错误监控
- 集成错误监控服务（如Sentry）
- 收集用户反馈
- 定期检查浏览器兼容性

### 更新策略
- 定期更新依赖（如果有）
- 关注浏览器新特性
- 保持文档同步更新

## 支持

如有问题，请通过以下方式获取支持：
- 查看README.md中的使用说明
- 检查浏览器控制台错误信息
- 提交Issue到项目仓库

---

**注意**: 这是一个纯前端应用，不需要后端服务支持。所有处理都在用户浏览器本地完成，确保数据隐私安全。